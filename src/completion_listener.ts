import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.tail();
    for (;;) {
        const message = await ns.readPort(1);
        if (message == 'NULL PORT DATA') {
            await ns.sleep(10);
            continue;
        }
        const json = JSON.parse(message as string);
        ns.print(`Received message: ${message}`);
    }
}
