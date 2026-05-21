import { Device } from './data';

export interface PlcDeviceMapping {
    id: string;
    roomId: 'living' | 'bedroom' | 'kitchen' | 'garage';
    appName: string;
    type: Device['type'];
    apiDeviceId: string;
    plcStatusTag: string;
    plcCommandTag: string;
    defaultPowerW: number;
}

export const PLC_DEVICE_MAPPINGS: PlcDeviceMapping[] = [
    {
        id: 'living_main_light',
        roomId: 'living',
        appName: 'Den chinh phong khach',
        type: 'light',
        apiDeviceId: 'living_main_light',
        plcStatusTag: 'M100.0',
        plcCommandTag: 'M110.0',
        defaultPowerW: 45,
    },
    {
        id: 'living_ambient_light',
        roomId: 'living',
        appName: 'Den hat phong khach',
        type: 'light',
        apiDeviceId: 'living_ambient_light',
        plcStatusTag: 'M100.1',
        plcCommandTag: 'M110.1',
        defaultPowerW: 25,
    },
    {
        id: 'living_ceiling_fan',
        roomId: 'living',
        appName: 'Quat tran phong khach',
        type: 'fan',
        apiDeviceId: 'living_ceiling_fan',
        plcStatusTag: 'M100.2',
        plcCommandTag: 'M110.2',
        defaultPowerW: 80,
    },
    {
        id: 'bedroom_ac',
        roomId: 'bedroom',
        appName: 'May lanh phong ngu',
        type: 'ac',
        apiDeviceId: 'bedroom_ac',
        plcStatusTag: 'M100.3',
        plcCommandTag: 'M110.3',
        defaultPowerW: 900,
    },
    {
        id: 'bedroom_light',
        roomId: 'bedroom',
        appName: 'Den ngu',
        type: 'light',
        apiDeviceId: 'bedroom_light',
        plcStatusTag: 'M100.4',
        plcCommandTag: 'M110.4',
        defaultPowerW: 15,
    },
    {
        id: 'kitchen_light',
        roomId: 'kitchen',
        appName: 'Den bep',
        type: 'light',
        apiDeviceId: 'kitchen_light',
        plcStatusTag: 'M100.5',
        plcCommandTag: 'M110.5',
        defaultPowerW: 35,
    },
    {
        id: 'kitchen_exhaust_fan',
        roomId: 'kitchen',
        appName: 'Quat hut bep',
        type: 'fan',
        apiDeviceId: 'kitchen_exhaust_fan',
        plcStatusTag: 'M100.6',
        plcCommandTag: 'M110.6',
        defaultPowerW: 150,
    },
    {
        id: 'kitchen_fridge_outlet',
        roomId: 'kitchen',
        appName: 'O cam tu lanh',
        type: 'outlet',
        apiDeviceId: 'kitchen_fridge_outlet',
        plcStatusTag: 'M100.7',
        plcCommandTag: 'M110.7',
        defaultPowerW: 150,
    },
    {
        id: 'garage_light',
        roomId: 'garage',
        appName: 'Den garage',
        type: 'light',
        apiDeviceId: 'garage_light',
        plcStatusTag: 'M101.0',
        plcCommandTag: 'M111.0',
        defaultPowerW: 60,
    },
    {
        id: 'garage_door_motor',
        roomId: 'garage',
        appName: 'Cua cuon garage',
        type: 'outlet',
        apiDeviceId: 'garage_door_motor',
        plcStatusTag: 'M101.1',
        plcCommandTag: 'M111.1',
        defaultPowerW: 500,
    },
];

export const getPlcMappingByDeviceId = (deviceId: string): PlcDeviceMapping | undefined => {
    return PLC_DEVICE_MAPPINGS.find((item) => item.apiDeviceId === deviceId);
};

export const buildPlcMappingSummary = () => {
    return PLC_DEVICE_MAPPINGS.map((item, index) => (
        `${index + 1}. ${item.appName}\n` +
        `PLC status: ${item.plcStatusTag} | PLC cmd: ${item.plcCommandTag}\n` +
        `API device: ${item.apiDeviceId}`
    )).join('\n\n');
};
