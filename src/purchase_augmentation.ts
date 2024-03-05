import { NS } from "@ns";
import { get_state, log } from "./singularity";

export async function main(ns: NS): Promise<void> {
    const state = get_state(ns);
    state.console_log = true;
    if (ns.singularity.purchaseAugmentation(ns.args[0] as string, ns.args[1] as string)) {
        log(ns, state, `Purchased ${ns.args[1]}`);
    } else {
        log(ns, state, `Failed to purchase ${ns.args[1]}`);
    }

}
