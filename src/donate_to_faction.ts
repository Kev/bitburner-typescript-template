import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.singularity.donateToFaction(ns.args[0] as string, ns.args[1] as number);
}
