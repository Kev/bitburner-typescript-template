import { NS } from "@ns";
import { port_hacks } from "./base";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.tail();
    ns.print("home; buy ", port_hacks.join("; buy "), ";");
}
