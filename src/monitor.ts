import { NS } from '@ns'
/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    for (;;) {
        for (const server_p of ns.args) {
            const server = server_p as string;
            ns.print(server, ": Security: ", ns.formatNumber(ns.getServerSecurityLevel(server)), "/", ns.formatNumber(ns.getServerMinSecurityLevel(server)), "  Money: ", ns.formatNumber(ns.getServerMoneyAvailable(server)), "/", ns.formatNumber(ns.getServerMaxMoney(server)));
        }

        await ns.sleep(10000);
    }
}
