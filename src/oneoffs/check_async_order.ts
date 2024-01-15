import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.tail();
    ns.writePort(42, "pre-exec");
    ns.print(ns.readPort(42));
    ns.exec("oneoffs/write_port.js", ns.getHostname(), 1, 'exec 1');
    ns.print(ns.readPort(42));
    ns.writePort(42, "mid-exec");
    ns.print(ns.readPort(42));
    ns.exec("oneoffs/write_port.js", ns.getHostname(), 1, 'exec 2');
    ns.print(ns.readPort(42));
    ns.writePort(42, "post-exec");
    ns.print(ns.readPort(42));

    await ns.print("not async");
    ns.print(ns.readPort(42));
    ns.print(ns.readPort(42));

    await ns.sleep(0);
    ns.print(ns.readPort(42));
    ns.print(ns.readPort(42));

}
