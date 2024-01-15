import { NS } from "@ns";
import { prepare_server } from "./base";

export async function main(ns: NS): Promise<void> {
    ns.tail();
    ns.disableLog("ALL");
    const target = ns.args[0] as string;
    await prepare_server(ns, target);
}
