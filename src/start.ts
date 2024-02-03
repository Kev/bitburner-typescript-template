import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.run("spread.js", 1);
    await ns.sleep(1);
    ns.run("buy_loop.js", 1, 256);
    ns.run("main_loop4.js", 1);
    // ns.run("faction_backdoors.js", 1);
    // ns.run("buy_hacks.js", 1);
}
