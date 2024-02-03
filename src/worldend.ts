import { NS } from "@ns";
import { Server, cached_server } from "./base";

export async function main(ns: NS): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const server : Server = cached_server(ns, "w0r1d_d43m0n")!;
    for (const host of server.path) {
        ns.singularity.connect(host);
    }
    await ns.singularity.installBackdoor();
}
