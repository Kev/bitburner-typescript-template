import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.run("buy_loop.js", 1);
    ns.run("spread.js", 1);
    ns.run("main_loop4.js", 1, 10);
}
