import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    for (const file of ns.singularity.getOwnedSourceFiles()) {
        ns.tprint(`${file.n}.${file.lvl}`);
    }

}
