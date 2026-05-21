import { defaultDevices, Device } from '../../constants/data';

export type HouseDevices = Record<string, Device[]>;

export const buildFallbackHouseDevices = (): HouseDevices => {
    return Object.keys(defaultDevices).reduce((acc, roomId) => {
        acc[roomId] = defaultDevices[roomId].map(device => ({
            ...device,
            roomId,
            source: 'local',
        }));
        return acc;
    }, {} as HouseDevices);
};

export const normalizeServerDevices = (devices: HouseDevices): HouseDevices => {
    return Object.keys(devices).reduce((acc, roomId) => {
        acc[roomId] = (devices[roomId] || []).map(device => ({
            ...device,
            roomId: device.roomId || roomId,
            source: 'server',
        }));
        return acc;
    }, {} as HouseDevices);
};

