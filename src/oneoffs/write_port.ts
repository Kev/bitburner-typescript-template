import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.tail();
    ns.writePort(42, ns.args.join(" "));
}
