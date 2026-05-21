export interface Room {
    id: string;
    name: string;
    devices: number;
    active: number;
    power: number;
    temp: number;
    humidity: number;
}

export interface Device {
    id: string;
    name: string;
    type: 'light' | 'fan' | 'ac' | 'outlet';
    isOn: boolean;
    power: number;
    ownerId?: string; // user-specific device
    entityId?: string;
    domain?: string;
    roomId?: string;
    source?: 'server' | 'local';
    available?: boolean;
}

export interface User {
    id: string;
    name: string;
    phone: string;
    password: string;
    role: 'admin' | 'user';
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    lastActive?: string;
}

export interface ActivityLog {
    id: string;
    userId: string;
    userName: string;
    houseOwnerName?: string;
    action: string;
    device?: string;
    room?: string;
    timestamp: string;
}

export const defaultRooms: Room[] = [
    { id: 'living', name: 'Phòng khách', devices: 5, active: 3, power: 850, temp: 26, humidity: 60 },
    { id: 'bedroom', name: 'Phòng ngủ', devices: 3, active: 1, power: 320, temp: 24, humidity: 55 },
    { id: 'kitchen', name: 'Nhà bếp', devices: 5, active: 2, power: 680, temp: 28, humidity: 70 },
    { id: 'garage', name: 'Garage', devices: 2, active: 0, power: 0, temp: 32, humidity: 45 },
];

export const defaultDevices: Record<string, Device[]> = {
    living: [
        { id: 'l1', name: 'Đèn chính', type: 'light', isOn: true, power: 45 },
        { id: 'l2', name: 'Đèn hắt', type: 'light', isOn: false, power: 25 },
        { id: 'f1', name: 'Quạt trần', type: 'fan', isOn: true, power: 80 },
        { id: 'ac1', name: 'Máy lạnh', type: 'ac', isOn: false, power: 1200 },
        { id: 'o1', name: 'Ổ cắm TV', type: 'outlet', isOn: true, power: 120 },
    ],
    bedroom: [
        { id: 'l3', name: 'Đèn ngủ', type: 'light', isOn: false, power: 15 },
        { id: 'ac2', name: 'Máy lạnh', type: 'ac', isOn: true, power: 900 },
        { id: 'o2', name: 'Ổ cắm sạc', type: 'outlet', isOn: true, power: 25 },
    ],
    kitchen: [
        { id: 'l4', name: 'Đèn bếp', type: 'light', isOn: true, power: 35 },
        { id: 'f2', name: 'Quạt hút', type: 'fan', isOn: true, power: 150 },
        { id: 'o3', name: 'Tủ lạnh', type: 'outlet', isOn: true, power: 150 },
        { id: 'o4', name: 'Lò vi sóng', type: 'outlet', isOn: false, power: 1200 },
        { id: 'o5', name: 'Máy rửa bát', type: 'outlet', isOn: false, power: 1800 },
    ],
    garage: [
        { id: 'l5', name: 'Đèn garage', type: 'light', isOn: false, power: 60 },
        { id: 'o6', name: 'Cửa cuốn', type: 'outlet', isOn: false, power: 500 },
    ],
};

export const buildEmptyHouseDevices = (): Record<string, Device[]> => ({
    living: [],
    bedroom: [],
    kitchen: [],
    garage: [],
});

export const defaultAdmin: User = {
    id: 'admin-001',
    name: 'Admin',
    phone: '0123456789',
    password: 'admin123',
    role: 'admin',
    status: 'approved',
    createdAt: new Date().toISOString(),
};

export const defaultApprovedUser: User = {
    id: 'user-demo-001',
    name: 'Người dùng mẫu',
    phone: '0987654321',
    password: 'user123',
    role: 'user',
    status: 'approved',
    createdAt: new Date().toISOString(),
};
