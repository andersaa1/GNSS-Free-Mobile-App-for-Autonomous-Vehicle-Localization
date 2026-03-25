export type MilestoneBoardSign = {
    destination: string;
    distance: number;
};

export type MilestoneBoard = {
    oid: number;
    roadNumber: number;
    roadName: number;
    direction: string;
    signs: MilestoneBoardSign[];
    lon: number;
    lat: number;
}