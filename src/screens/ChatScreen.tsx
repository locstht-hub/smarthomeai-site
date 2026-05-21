import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    Actions,
    Bubble,
    Composer,
    GiftedChat,
    IMessage,
    InputToolbar,
    MessageText,
    Send,
} from 'react-native-gifted-chat';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useVoice, VoiceEvent, VoiceKit, VoiceMode } from 'react-native-voicekit';
import { useAuth } from '../contexts/AuthContext';
import { useSmartHomeServer } from '../contexts/SmartHomeServerContext';
import { Colors } from '../constants/colors';

const APP_AVATAR = require('../../assets/icon.png');

const QUICK_REPLIES = [
    'Bat den phong khach',
    'Tat tat ca thiet bi',
    'Muc tieu thu dien hom nay',
    'Bat che do ngu',
];

export default function ChatScreen() {
    const { user } = useAuth();
    const { client, isConfigured, status } = useSmartHomeServer();
    const tabBarHeight = useBottomTabBarHeight();
    const lastHandledTranscriptRef = useRef('');

    const initialMessages = useMemo<IMessage[]>(() => [
        {
            _id: 'welcome-1',
            text: `Xin chao ${user?.name || 'ban'}! Minh la tro ly Smart Home. Ban can ho tro dieu khien gi hom nay?`,
            createdAt: new Date(),
            user: {
                _id: 'assistant',
                name: 'Smart Home AI',
                avatar: APP_AVATAR,
            },
        },
    ], [user?.name]);

    const [messages, setMessages] = useState<IMessage[]>(initialMessages);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [isVoiceStarting, setIsVoiceStarting] = useState(false);
    const {
        available: isVoiceAvailable,
        listening: isListening,
        transcript,
        startListening,
        stopListening,
        resetTranscript,
    } = useVoice({
        locale: 'vi-VN',
        mode: VoiceMode.ContinuousAndStop,
        enablePartialResults: true,
        silenceTimeoutMs: 1400,
        muteAndroidBeep: true,
    });

    const pushBotReply = useCallback((text: string) => {
        const botReply: IMessage = {
            _id: `bot-${Date.now()}`,
            text,
            createdAt: new Date(),
            user: {
                _id: 'assistant',
                name: 'Smart Home AI',
                avatar: APP_AVATAR,
            },
        };

        setMessages(previous => GiftedChat.append(previous, [botReply]));
    }, []);

    const buildUserMessage = useCallback((text: string): IMessage => ({
        _id: `user-${Date.now()}`,
        text,
        createdAt: new Date(),
        user: {
            _id: user?.id || 'guest',
            name: user?.name || 'Ban',
            avatar: APP_AVATAR,
        },
    }), [user?.id, user?.name]);

    const processUserText = useCallback(async (userMessage: string) => {
        if (!userMessage) {
            return;
        }

        if (!isConfigured) {
            pushBotReply(`Server API chua duoc cau hinh. Minh da ghi nhan "${userMessage}" va hien dang dung phan hoi du phong.`);
            return;
        }

        try {
            const reply = await client.chat(userMessage);
            pushBotReply(reply || `Minh da chuyen cau lenh "${userMessage}" toi server rieng.`);
        } catch (error) {
            console.error('Error processing Smart Home server chat:', error);
            pushBotReply('Khong the goi Server API luc nay. Ban hay thu lai khi ket noi on dinh hon.');
        }
    }, [client, isConfigured, pushBotReply]);

    const onSend = useCallback(async (newMessages: IMessage[] = [], options?: { skipAppend?: boolean }) => {
        if (!options?.skipAppend) {
            setMessages(previous => GiftedChat.append(previous, newMessages));
        }

        const userMessage = newMessages[0]?.text?.trim();
        if (!userMessage) {
            return;
        }

        await processUserText(userMessage);
    }, [processUserText]);

    useEffect(() => {
        const transcriptToSend = transcript.trim();

        if (isListening || !transcriptToSend) {
            return;
        }

        if (lastHandledTranscriptRef.current === transcriptToSend) {
            return;
        }

        lastHandledTranscriptRef.current = transcriptToSend;
        resetTranscript();
        void onSend([buildUserMessage(transcriptToSend)]);
    }, [buildUserMessage, isListening, onSend, resetTranscript, transcript]);

    useEffect(() => {
        const handleVoiceError = (error: { message?: string }) => {
            const message = error?.message || 'Khong the nhan dien giong noi luc nay.';
            setVoiceError(message);
            setIsVoiceStarting(false);
            pushBotReply(`Mic gap su co: ${message}`);
        };

        VoiceKit.addListener(VoiceEvent.Error, handleVoiceError);

        return () => {
            VoiceKit.removeListener(VoiceEvent.Error, handleVoiceError);
        };
    }, [pushBotReply]);

    useEffect(() => {
        if (!isListening) {
            setIsVoiceStarting(false);
        }
    }, [isListening]);

    const handleQuickReply = useCallback((replyText: string) => {
        void onSend([buildUserMessage(replyText)]);
    }, [buildUserMessage, onSend]);

    const handleVoicePress = useCallback(async () => {
        setVoiceError(null);

        if (!isVoiceAvailable) {
            pushBotReply('Thiet bi nay chua san sang cho speech-to-text. Ban can rebuild development build sau khi them native module va cap quyen microphone.');
            return;
        }

        try {
            if (isListening) {
                await stopListening();
                return;
            }

            if (Platform.OS === 'android') {
                const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                if (!hasPermission) {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                        {
                            title: 'Cho phep microphone',
                            message: 'Ung dung can microphone de nghe lenh giong noi va gui sang server rieng.',
                            buttonPositive: 'Cho phep',
                            buttonNegative: 'Tu choi',
                        },
                    );

                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        pushBotReply('Ban chua cap quyen microphone, nen minh chua the nghe lenh giong noi.');
                        return;
                    }
                }
            }

            lastHandledTranscriptRef.current = '';
            resetTranscript();
            setIsVoiceStarting(true);
            await startListening();
        } catch (error) {
            setIsVoiceStarting(false);
            const message = error instanceof Error ? error.message : 'Khong the bat microphone luc nay.';
            setVoiceError(message);
            pushBotReply(`Khong the bat mic: ${message}`);
        }
    }, [isListening, isVoiceAvailable, pushBotReply, resetTranscript, startListening, stopListening]);

    const voiceHint = useMemo(() => {
        if (!isVoiceAvailable) {
            return 'Mic chua san sang tren development build hien tai.';
        }
        if (isListening) {
            return transcript.trim() || 'Dang nghe... hay noi lenh cua ban';
        }
        if (voiceError) {
            return voiceError;
        }
        return 'Nhan mic, noi lenh, app se gui transcript sang Server API.';
    }, [isListening, isVoiceAvailable, transcript, voiceError]);

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0b2f5b', '#0f4a8a']} style={styles.header}>
                <Image source={APP_AVATAR} style={styles.headerIcon} />
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>Smart Home AI</Text>
                    <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.headerSubtitle}>
                            {isConfigured
                                ? (status === 'connected' ? 'Dang noi voi Server API' : 'Da cau hinh Server API')
                                : 'Can cau hinh Server API de dieu khien thiet bi that'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickReplyRow}
                contentContainerStyle={styles.quickReplyContent}
            >
                {QUICK_REPLIES.map((reply) => (
                    <TouchableOpacity key={reply} style={styles.quickReplyBtn} onPress={() => handleQuickReply(reply)}>
                        <Text style={styles.quickReplyText}>{reply}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.voiceBanner}>
                <View style={styles.voiceBannerTextWrap}>
                    <Text style={styles.voiceBannerTitle}>
                        {isListening ? 'Dang nhan dien giong noi' : 'Lenh giong noi'}
                    </Text>
                    <Text style={styles.voiceBannerSubtitle}>{voiceHint}</Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.voiceButton,
                        isListening && styles.voiceButtonActive,
                        !isVoiceAvailable && styles.voiceButtonDisabled,
                    ]}
                    onPress={() => void handleVoicePress()}
                    disabled={isVoiceStarting && !isListening}
                    activeOpacity={0.85}
                >
                    {isVoiceStarting && !isListening ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.voiceButtonText}>{isListening ? 'Stop' : 'Mic'}</Text>
                    )}
                </TouchableOpacity>
            </View>

            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{
                    _id: user?.id || 'guest',
                    name: user?.name || 'Ban',
                    avatar: APP_AVATAR,
                }}
                placeholder="Nhap noi dung chat o day..."
                alwaysShowSend
                minInputToolbarHeight={108}
                minComposerHeight={74}
                maxComposerHeight={180}
                keyboardShouldPersistTaps="handled"
                bottomOffset={tabBarHeight}
                textInputProps={{
                    placeholderTextColor: Colors.slate[400],
                    autoCorrect: false,
                    spellCheck: false,
                    autoCapitalize: 'sentences',
                    keyboardType: 'default',
                    multiline: true,
                    textAlignVertical: 'top',
                    style: styles.textInput,
                }}
                renderBubble={(props) => (
                    <Bubble
                        {...props}
                        wrapperStyle={{
                            right: { backgroundColor: Colors.primary[600] },
                            left: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: Colors.slate[200] },
                        }}
                        textStyle={{
                            right: { color: '#ffffff' },
                            left: { color: Colors.slate[800] },
                        }}
                    />
                )}
                renderInputToolbar={(props) => (
                    <InputToolbar
                        {...props}
                        containerStyle={styles.toolbar}
                        primaryStyle={styles.toolbarPrimary}
                    />
                )}
                renderActions={(props) => (
                    <Actions
                        {...props}
                        icon={() => (
                            <View style={[
                                styles.micAccessory,
                                isListening && styles.micAccessoryActive,
                            ]}>
                                <Text style={styles.micAccessoryText}>{isListening ? 'Stop' : 'Mic'}</Text>
                            </View>
                        )}
                        containerStyle={styles.micAccessoryContainer}
                        onPressActionButton={() => void handleVoicePress()}
                    />
                )}
                renderComposer={(props) => (
                    <Composer
                        {...props}
                        textInputStyle={styles.textInput}
                        placeholderTextColor={Colors.slate[400]}
                    />
                )}
                renderMessageText={(props) => (
                    <MessageText
                        {...props}
                        textStyle={{
                            right: { color: '#ffffff' },
                            left: { color: Colors.slate[800] },
                        }}
                        customTextStyle={{ lineHeight: 20 }}
                        textProps={{ selectable: true }}
                    />
                )}
                renderSend={(props) => (
                    <Send {...props} containerStyle={styles.sendContainer}>
                        <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.sendPill}>
                            <Text style={styles.sendText}>Gui</Text>
                        </LinearGradient>
                    </Send>
                )}
                listViewProps={{
                    contentContainerStyle: { paddingBottom: 10, paddingHorizontal: 4 },
                    keyboardShouldPersistTaps: 'handled',
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 54 : 18,
        paddingBottom: 14,
    },
    headerTextWrap: { flex: 1 },
    headerIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.88)' },
    quickReplyRow: {
        maxHeight: 58,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: Colors.slate[200],
    },
    quickReplyContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    quickReplyBtn: {
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[200],
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 999,
    },
    quickReplyText: {
        fontSize: 12,
        color: Colors.primary[700],
        fontWeight: '500',
    },
    voiceBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: Colors.slate[200],
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    voiceBannerTextWrap: { flex: 1, gap: 2 },
    voiceBannerTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.slate[800],
    },
    voiceBannerSubtitle: {
        fontSize: 12,
        lineHeight: 18,
        color: Colors.slate[500],
    },
    voiceButton: {
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: Colors.primary[600],
    },
    voiceButtonActive: {
        backgroundColor: Colors.red[500],
    },
    voiceButtonDisabled: {
        backgroundColor: Colors.slate[400],
    },
    voiceButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    toolbar: {
        borderTopWidth: 1,
        borderTopColor: Colors.slate[200],
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingTop: 12,
        paddingBottom: 12,
    },
    toolbarPrimary: { alignItems: 'center', minHeight: 82 },
    micAccessoryContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
        marginRight: 2,
        marginBottom: 0,
        width: 54,
    },
    micAccessory: {
        minWidth: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: Colors.slate[200],
    },
    micAccessoryActive: {
        backgroundColor: Colors.red[500],
    },
    micAccessoryText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.slate[800],
    },
    textInput: {
        color: Colors.slate[800],
        backgroundColor: Colors.slate[50],
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.slate[200],
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 16,
        minHeight: 74,
        fontSize: 17,
        marginTop: 0,
        marginLeft: 0,
        marginRight: 8,
        maxHeight: 180,
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
        marginRight: 2,
    },
    sendPill: { borderRadius: 20, paddingVertical: 11, paddingHorizontal: 14 },
    sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
