import { NS } from '@ns'
import { colours } from './base';
/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.tail();
    const [screenX, screenY] = ns.ui.windowSize();
    if (screenX == 3440 && screenY == 1349) {
        ns.moveTail(2350, 5);
        ns.resizeTail(900, 270);
    }
    for (;;) {
        ns.clearLog();
        // ns.print("Screen is x", screenX, " y", screenY);
        for (const server_p of ns.args) {
            const server = server_p as string;
            const security = ns.getServerSecurityLevel(server);
            const security_min = ns.getServerMinSecurityLevel(server);
            const security_colour = security == security_min ? colours.white : colours.red;
            const money = ns.getServerMoneyAvailable(server);
            const max_money = ns.getServerMaxMoney(server);
            const money_colour = money == max_money ? colours.white : colours.red;
            ns.print(colours.cyan, server, colours.reset, ": Security: ", security_colour, ns.formatNumber(security), "/", ns.formatNumber(security_min), colours.reset,  "  Money: ", money_colour, ns.formatNumber(money), "/", ns.formatNumber(max_money), colours.reset);
        }

        await ns.sleep(2000);
    }
}
