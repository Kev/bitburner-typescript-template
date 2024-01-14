import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
    const action = ns.args[0] as string;
    const target = ns.args[1] as string;
    const delay = ns.args.length > 2 ? parseInt(ns.args[2] as string) : 0;
    const options = delay > 0 ? {'additionalMsec': delay} : {};
    switch (action) {
        case 'hack':
            await ns.hack(target, options);
            break;
        case 'weaken':
            await ns.weaken(target, options);
            break;
        case 'grow':
            await ns.grow(target, options);
            break;
        default:
            throw new Error(`Unknown action ${action}`);
    }
}