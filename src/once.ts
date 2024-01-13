import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
    const action = ns.args[0] as string;
    const target = ns.args[1] as string;
    switch (action) {
        case 'hack':
            await ns.hack(target);
            break;
        case 'weaken':
            await ns.weaken(target);
            break;
        case 'grow':
            await ns.grow(target);
            break;
        default:
            throw new Error(`Unknown action ${action}`);
    }
}