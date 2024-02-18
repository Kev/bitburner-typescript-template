import { NS } from "@ns";
import { log } from "./singularity";

export async function main(ns: NS): Promise<void> {
    if (ns.singularity.purchaseAugmentation(ns.args[0] as string, ns.args[1] as string)) {
        log(ns, `Purchased ${ns.args[1]}`);
    } else {
        log(ns, `Failed to purchase ${ns.args[1]}`);
    }

}
