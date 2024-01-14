import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
    const target = ns.args[0] as string;
    const delay = ns.args.length > 1 ? parseInt(ns.args[1] as string) : 0;
    const options = delay > 0 ? { 'additionalMsec': delay } : {};
    await ns.grow(target, options);
}