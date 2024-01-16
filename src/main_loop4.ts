import { NS } from "@ns";
import { best_targets_uncached, cached_servers, farm_out, hwgw, prepare_server, rooted, wait_for } from "base";

class TargetCalculation {
    name = '';
    hack_threads!: number;
    hack_weaken_threads!: number;
    grow_threads!: number;
    grow_weaken_threads!: number;
    grow_time!: number;
    hack_time!: number;
    weaken_time!: number;
    server_ram_requirements!: Map<string, number>;
}

async function calculate_target_with_formulas(ns: NS, target: string, hack_percentage: number): Promise<TargetCalculation> {
    const simulated_server = ns.getServer(target);
    simulated_server.hackDifficulty = simulated_server.minDifficulty;
    simulated_server.moneyAvailable = simulated_server.moneyMax ?? 0;
    const player = ns.getPlayer();

    const per_thread_hack_amount = ns.formulas.hacking.hackPercent(simulated_server, player);
    const hack_threads = Math.ceil(hack_percentage / per_thread_hack_amount);

    simulated_server.moneyAvailable = (simulated_server.moneyMax ?? 0) * (1 - hack_threads * per_thread_hack_amount);
    // ns.print(target, " simulating ", ns.formatNumber(simulated_server.moneyAvailable), "/", ns.formatNumber(simulated_server.moneyMax ?? 0), " money after ", hack_threads, " hack threads");

    const grow_threads = Math.ceil(ns.formulas.hacking.growThreads(simulated_server, player, simulated_server.moneyMax ?? 0));
    const hack_weaken_threads = Math.ceil(hack_threads * 0.002 / 0.05);
    const grow_weaken_threads = Math.ceil(grow_threads * 0.004 / 0.05);

    const servers = rooted(cached_servers(ns));
    const server_ram_requirements: Map<string, number> = new Map<string, number>();
    for (const server of servers) {
        const needed = calculate_needed_ram(ns, server, hack_threads, hack_weaken_threads, grow_threads, grow_weaken_threads);
        if (needed < ns.getServerMaxRam(server)) {
            server_ram_requirements.set(server, needed);
        } else {
            ns.print("Not including ", server, " in calculations for ", target, " because it doesn't have enough RAM (", ns.formatRam(ns.getServerMaxRam(server)), "/", ns.formatRam(needed), ").");
        }

    }

    const grow_time = ns.formulas.hacking.growTime(simulated_server, player);
    const hack_time = ns.formulas.hacking.hackTime(simulated_server, player);
    const weaken_time = ns.formulas.hacking.weakenTime(simulated_server, player);

    return {
        name: target,
        hack_threads: hack_threads,
        hack_weaken_threads: hack_weaken_threads,
        grow_threads: grow_threads,
        grow_weaken_threads: grow_weaken_threads,
        grow_time: grow_time,
        hack_time: hack_time,
        weaken_time: weaken_time,
        server_ram_requirements: server_ram_requirements,
    };
}

async function calculate_target_without_formulas(ns: NS, target: string, hack_percentage: number): Promise<TargetCalculation> {
    ns.print("Calculating target ", target, " with hack percentage ", hack_percentage);
    const max_money = ns.getServerMaxMoney(target);
    const hack_amount = max_money * hack_percentage;
    const full_hack_threads = Math.floor(ns.hackAnalyzeThreads(target, hack_amount));
    // const hack_security_increase = ns.hackAnalyzeSecurity(full_hack_threads, target);
    const hack_security_increase = full_hack_threads * 0.002;
    const full_hack_weaken_threads = Math.ceil(hack_security_increase / 0.05) + 1; // +1 in case of float rounding errors
    const hack_pids = await farm_out(ns, 'hack_once.js', full_hack_threads, target);
    const hack_security_pids = await farm_out(ns, 'weaken_once.js', full_hack_weaken_threads, target);
    await wait_for(ns, hack_pids);
    await wait_for(ns, hack_security_pids);
    ns.print("  After executing initial hack threads, security is ", ns.formatNumber(ns.getServerSecurityLevel(target)), " and money is ", ns.formatNumber(ns.getServerMoneyAvailable(target)), " of an expected ", ns.formatNumber(max_money * (1 - hack_percentage)));

    const grow_multiplier = 1 / (1 - hack_percentage);
    const full_grow_threads = Math.ceil(ns.growthAnalyze(target, grow_multiplier)) + 1; // Just adding 1 in case of float rounding errors
    // const grow_security_increase = ns.growthAnalyzeSecurity(full_grow_threads, target);
    const grow_security_increase = full_grow_threads * 0.004;
    const full_grow_weaken_threads = Math.ceil(grow_security_increase / 0.05) + 1; // +1 in case of float rounding errors
    const grow_pids = await farm_out(ns, 'grow_once.js', full_grow_threads, target);
    const grow_security_pids = await farm_out(ns, 'weaken_once.js', full_grow_weaken_threads, target);
    await wait_for(ns, grow_pids);
    await wait_for(ns, grow_security_pids);
    ns.print("  After executing initial grow threads, security is ", ns.getServerSecurityLevel(target), " and money is ", ns.getServerMoneyAvailable(target));

    ns.print("  Using hack proportion of ", hack_percentage, " and growth multiplier of ", grow_multiplier)



    const grow_time = ns.getGrowTime(target);
    const hack_time = ns.getHackTime(target);
    const weaken_time = ns.getWeakenTime(target);

    const servers = rooted(cached_servers(ns));
    const server_ram_requirements: Map<string, number> = new Map<string, number>();
    for (const server of servers) {
        server_ram_requirements.set(server, calculate_needed_ram(ns, server, full_hack_threads, full_hack_weaken_threads, full_grow_threads, full_grow_weaken_threads));
    }

    return {
        name: target,
        hack_threads: full_hack_threads,
        hack_weaken_threads: full_hack_weaken_threads,
        grow_threads: full_grow_threads,
        grow_weaken_threads: full_grow_weaken_threads,
        grow_time: grow_time,
        hack_time: hack_time,
        weaken_time: weaken_time,
        server_ram_requirements: server_ram_requirements
    };
}

function calculate_needed_ram(ns: NS, server: string, hack_threads: number, hack_weaken_threads: number, grow_threads: number, grow_weaken_threads: number): number {
    return ns.getScriptRam('hack_once.js', server) * hack_threads + ns.getScriptRam('weaken_once.js', server) * (hack_weaken_threads + grow_weaken_threads) + ns.getScriptRam('grow_once.js', server) * grow_threads;
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.tail();
    const num_servers = ns.args.length > 0 ? ns.args[0] as number : 1;
    const hack_percentage = 0.3;

    const formulas = ns.fileExists('Formulas.exe');
    const targets = best_targets_uncached(ns, num_servers);
    ns.print("Targets: ", targets.join(", "));
    ns.run('monitor.js', 1, ...targets);
    if (formulas) {
        ns.print("Using formulas, skipping preparation");
    } else {
        const prepare_pids = [];
        for (const target of targets) {
            prepare_pids.push(ns.run("prepare.js", 1, target));
        }
        ns.print("Waiting for prepare to finish.");
        await wait_for(ns, prepare_pids);
    }
    ns.print("Calculating target threads");
    const target_calculations: Array<TargetCalculation> = [];
    for (const target of targets) {
        const calculations = formulas ? await calculate_target_with_formulas(ns, target, hack_percentage) : await calculate_target_without_formulas(ns, target, hack_percentage);
        ns.print("  ", calculations.name, " needs ", calculations.hack_threads, " hack threads, ", calculations.hack_weaken_threads, " hack weaken threads, ", calculations.grow_threads, " grow threads, ", calculations.grow_weaken_threads, " grow weaken threads, ", ns.formatNumber(calculations.grow_time / 1000), "s grow time, ", ns.formatNumber(calculations.hack_time / 1000), "s hack time, ", ns.formatNumber(calculations.weaken_time / 1000), "s weaken time.");
        target_calculations.push(calculations);
    }
    // ns.exit();
    const hwgw_ram = ns.getScriptRam('hwgw.js');
    // let last_now = Date.now();
    const home_ram = ns.getServerMaxRam('home');
    // let launched_batches = 0;
    const unprepared = new Map<string, number>();
    const allowed_unprepared_cycles = 100;
    for (; ;) {
        let all_prepared = true;
        for (const target of target_calculations) {
            const target_server = ns.getServer(target.name);
            if (target_server.hackDifficulty == target_server.minDifficulty && target_server.moneyAvailable == target_server.moneyMax) {
                unprepared.set(target.name, 0);
                for (const server_name of target.server_ram_requirements.keys()) {
                    const server_used_ram = ns.getServerUsedRam(server_name);
                    const needed_ram = target.server_ram_requirements.get(server_name) || 0;
                    const server = ns.getServer(server_name);

                    const server_ram = server.maxRam - server_used_ram;
                    if (server_ram < needed_ram) {
                        // Skip servers that can't fit a full batch in
                        // ns.print("Skipping ", server_name, " because it only has ", ns.formatRam(server_ram), " RAM available, but needs ", ns.formatRam(needed_ram), " RAM.");
                        continue;
                    }
                    while (home_ram - ns.getServerUsedRam('home') < hwgw_ram) {
                        await ns.sleep(5);
                    }
                    await hwgw(ns, server_name, target.hack_threads, target.hack_weaken_threads, target.grow_threads, target.grow_weaken_threads, target.name, target.hack_time, target.grow_time, target.weaken_time);
                    // if (launched_batches % 1000 == 999) {
                    //     ns.print("Launched ", launched_batches + 1, " batches");
                    // }
                    // launched_batches++;
                }
                await ns.sleep(1);
            } else {
                const cycles = unprepared.get(target.name) || 0;
                if (cycles == allowed_unprepared_cycles || (cycles >= allowed_unprepared_cycles && cycles % 300000 == 0)) {
                    // Try to quickly reprep, and if that hasn't resolved in 5 minutes, try again
                    ns.print("Target ", target.name, " has been unprepared for ", cycles, " cycles, starting to prepare.");
                    await prepare_server(ns, target.name, false); // Don't wait for the result
                }
                unprepared.set(target.name, cycles + 1);
                all_prepared = false;
            }
        }
        if (!all_prepared) {
            await ns.sleep(1);
        }
        // const now = Date.now();
        // await ns.sleep(Math.min(10, Math.max(0, now - last_now)));
        // last_now = Date.now();
    }
}


// TODO: Align prepare so the grow and weaken threads complete (almost) together