import { NS } from '@ns'
import { export_state, get_state, run_corporation } from './singularity';

export async function main(ns: NS): Promise<void> {
    const state = get_state(ns);
    state.console_log = true;
    await run_corporation(ns, state);
    ns.tprint("Done");
    export_state(ns, state);
}