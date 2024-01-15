import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
    const server = ns.args[0] as string;
    const hack_threads = ns.args[1] as number;
    const hack_weaken_threads = ns.args[2] as number;
    const grow_threads = ns.args[3] as number;
    const grow_weaken_threads = ns.args[4] as number;
    const target = ns.args[5] as string;
    const hack_delay = ns.args[6] as number;
    const grow_delay = ns.args[7] as number;
    ns.exec('hack_once.js', server, hack_threads, target, hack_delay);
    ns.exec('weaken_once.js', server, hack_weaken_threads, target, 1);
    ns.exec('grow_once.js', server, grow_threads, target, grow_delay + 2);
    ns.exec('weaken_once.js', server, grow_weaken_threads, target, 3);
}