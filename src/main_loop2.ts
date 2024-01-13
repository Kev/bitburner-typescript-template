import { NS } from '@ns'

function string_in(s: string, a: Array<string>) {
    for (const i of a) {
        if (s == i) {
            return true;
        }
    }
    return false;
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    for (; ;) {
        const to_scan: Array<string> = ['home'];
        const scanned: Array<string> = [];
        const rooted: Array<string> = ['home'];

        // Find all usable hosts
        while (to_scan.length > 0) {
            const host: string = to_scan.pop() || '';
            const adjacents: Array<string> = await ns.scan(host);
            scanned.push(host);
            for (const adjacent of adjacents) {
                if (string_in(adjacent, scanned)) {
                    continue;
                }
                if (ns.hasRootAccess(adjacent) && !(string_in(adjacent, rooted))) {
                    rooted.push(adjacent);
                    to_scan.push(adjacent);
                }
            }
        }

        const target = ns.getHackingLevel() >= 170 ? 'phantasy' : (ns.getHackingLevel() >= 20 ? 'joesguns' : 'n00dles');
        // Prepare the target for min security/max cash
        const grow_security = 0.004;
        const hack_security = 0.002;
        const weaken_security = 0.05;



        const grow_memory = ns.getScriptRam('just_grow.js', 'home');
        const hack_memory = ns.getScriptRam('just_hack.js', 'home');
        const weaken_memory = ns.getScriptRam('just_weaken.js', 'home');
        let excess_security = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
        while (excess_security > 0) {
            const weakens_needed = Math.max(1, Math.ceil(excess_security / weaken_security));
            let remaining_ram_needed = weaken_memory * weakens_needed;
            for (const server of rooted) {
                if (remaining_ram_needed <= 0) {
                    continue;
                }
                const server_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
                remaining_ram_needed -= server_ram;
                await ns.exec('just_weaken.js', server, Math.floor(server_ram / weaken_memory), target);
            }
            excess_security = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
            await ns.sleep(100);
        }

        const max_money = ns.getServerMaxMoney(target);
        // let cash_deficit = max_money - ns.getServerMoneyAvailable(target);


        const player = ns.getPlayer();
        const target_server = ns.getServer(target);
        const prepared_target_server = ns.getServer(target);
        prepared_target_server.moneyAvailable = 0;
        const hack_percent = ns.formulas.hacking.hackPercent(target_server, player);
        const needed_hack_threads = Math.floor(100 / hack_percent);
        const needed_grow_threads = Math.ceil(ns.formulas.hacking.growThreads(prepared_target_server, player, max_money));
        const needed_weaken_threads = Math.ceil((needed_hack_threads * hack_security + needed_grow_threads * grow_security) / weaken_security);
        const needed_hack_ram = needed_hack_threads * hack_memory;
        const needed_grow_ram = needed_grow_threads * grow_memory;
        const needed_weaken_ram = needed_weaken_threads * weaken_memory;

        const total_needed_ram = needed_hack_ram + needed_grow_ram + needed_weaken_ram;

        const hack_proportion = needed_hack_ram / total_needed_ram;
        const grow_proportion = needed_grow_ram / total_needed_ram;
        const weaken_proportion = needed_weaken_ram / total_needed_ram;
        ns.print("Total needed ram to max ", target, ": ", total_needed_ram);
        ns.print("Proportions: hack ", hack_proportion, " grow ", grow_proportion, " weaken ", weaken_proportion);

        const home_ram_to_use = Math.min(ns.getServerMaxRam('home') - ns.getServerUsedRam('home'), total_needed_ram);
        ns.print("Home ram to use: ", home_ram_to_use);

        const weaken_threads = Math.floor(home_ram_to_use * weaken_proportion);
        const grow_threads = Math.floor(home_ram_to_use * grow_proportion);
        const hack_threads = Math.floor(home_ram_to_use * hack_proportion);
        ns.print("Threads: weaken ", weaken_threads, " grow ", grow_threads, " hack ", hack_threads);
        await ns.exec('once.js', 'home', weaken_threads, "weaken", target);
        await ns.exec('once.js', 'home', grow_threads, "grow", target);
        await ns.exec('once.js', 'home', hack_threads, "hack", target);


    }
}





