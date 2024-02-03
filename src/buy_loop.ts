import { NS } from '@ns'
import { purchased_server_limit, purchased_server_ram_limit_gb } from './base';
/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.tail();
    const [screenX, screenY] = ns.ui.windowSize();
    if (screenX == 3440 && screenY == 1349) {
        ns.moveTail(2350, 570);
        ns.resizeTail(900, 270);
    }
    const ram = 8;
    const desired_ram: number = ns.args.length > 0 ? parseInt(ns.args[0] as string) : purchased_server_ram_limit_gb;
    let should_stop = false;
    let last_server_count = 0;
    while (!should_stop) {
        should_stop = true;
        let i = 0;
        while (i < purchased_server_limit) {
            const name: string = "wondersheep-" + i;
            ++i;
            // ns.print("Considering purchase of ", name);
            if (ns.serverExists(name)) {
                // ns.print("Already purchased, skipping");
                continue;
            }
            const cash = ns.getServerMoneyAvailable("home");
            const cost = ns.getPurchasedServerCost(ram);
            // ns.print("Need ", cost, " have ", cash);
            if (cash > cost) {
                ns.print("Purchasing ", name);
                /*const hostname : string = */ns.purchaseServer(name, ram);
                await ns.sleep(1000);
            } else {
                ns.print("Can't afford ", name);
                should_stop = false;
            }
        }
        const servers = ns.getPurchasedServers();
        if (servers.length != last_server_count) {
            ns.print("Servers = ", servers);
            last_server_count = servers.length;
        }
        for (const server of servers) {
            const current_ram = ns.getServerMaxRam(server);
            // const max_ram = ns.getPurchasedServerMaxRam();
            const upgrade_cost = ns.getPurchasedServerUpgradeCost(server, current_ram * 2);
            // ns.print("Considering ", server, " for upgrade. Current RAM = ", current_ram, ", max = ", max_ram, " upgrade cost ", upgrade_cost);
            if (current_ram >= desired_ram) {
                // ns.print(server, " already at ", ns.formatRam(desired_ram), "(", ns.formatRam(current_ram), "), skipping");
                continue;
            } else {
                should_stop = false;
            }
            if (upgrade_cost < ns.getServerMoneyAvailable("home")) {
                ns.print("Buying ", ns.formatRam(current_ram * 2), " for ", server);
                ns.upgradePurchasedServer(server, current_ram * 2);
                await ns.sleep(1000);
            }
        }
        // ns.print("Sleeping before Next loop");
        await ns.sleep(1000);
    }
}
