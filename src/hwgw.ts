import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
    const server = ns.args[0] as string;
    const hack_threads = ns.args[1] as number;
    const hack_weaken_threads = ns.args[2] as number;
    const grow_threads = ns.args[3] as number;
    const grow_weaken_threads = ns.args[4] as number;
    const target = ns.args[5] as string;
    const hack_time = ns.args[6] as number;
    const grow_time = ns.args[7] as number;
    const weaken_time = ns.args[8] as number;
    const port = ns.args[9] as number;
    const batch = ns.args[10] as number;
    // Set to finish on the second, starting in 10s
    const target_time = Math.floor((Date.now() + weaken_time) / 1000 + 10) * 1000;
    ns.exec('hack_once.js', server, { threads: hack_threads, temporary: true }, target, target_time, hack_time, port, batch);
    ns.exec('weaken_once.js', server, { threads: hack_weaken_threads, temporary: true }, target, target_time, weaken_time, port, batch);
    ns.exec('grow_once.js', server, { threads: grow_threads, temporary: true }, target, target_time, grow_time, port, batch);
    ns.exec('weaken_once.js', server, { threads: grow_weaken_threads, temporary: true }, target, target_time, weaken_time, port, batch);
}