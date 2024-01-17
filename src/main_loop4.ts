import { NS } from "@ns";
import { best_targets_uncached, cached_servers, farm_out, prepare_server, rooted, wait_for } from "base";

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
        // if (needed < ns.getServerMaxRam(server)) {
        server_ram_requirements.set(server, needed);
        ns.print("  ", server, " needs ", ns.formatRam(needed), " RAM for a full batch against ", target, ".");
        // } else {
        //     ns.print("Not including ", server, " in calculations for ", target, " because it doesn't have enough RAM (", ns.formatRam(ns.getServerMaxRam(server)), "/", ns.formatRam(needed), ").");
        // }

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
    ns.print("  Calculating RAM requirements for ", servers.length, " servers: ", servers.join(", "));
    const server_ram_requirements: Map<string, number> = new Map<string, number>();
    for (const server of servers) {
        server_ram_requirements.set(server, calculate_needed_ram(ns, server, full_hack_threads, full_hack_weaken_threads, full_grow_threads, full_grow_weaken_threads));
        ns.print("  ", server, " needs ", ns.formatRam(server_ram_requirements.get(server) || 0), " RAM for a full batch against ", target, ".");
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
    const [screenX, screenY] = ns.ui.windowSize();
    if (screenX == 3440 && screenY == 1349) {
        ns.moveTail(2350, 285);
        ns.resizeTail(900, 270);
    }

    const port = ns.ps().filter(p => p.filename == 'main_loop4.js').length;
    ns.print("Using port ", port);

    // const num_servers = ns.args.length > 0 ? ns.args[0] as number : 1;
    const hack_percentage = 0.3;

    const [target_name] = ns.args.length > 0 ? [ns.args[0] as string] : best_targets_uncached(ns, 1);
    ns.print("Target: ", target_name);
    ns.run('monitor.js', 1, target_name);

    ns.print("Calculating target threads");
    let target!: TargetCalculation;




    // Ensure every host has the right scripts and that they've all been run once so they get compiled into modules
    for (const server of rooted(cached_servers(ns))) {
        ns.scp(['hack_once.js', 'weaken_once.js', 'grow_once.js', 'base.js'], server);
    }
    for (const task of ['hack_once.js', 'weaken_once.js', 'grow_once.js']) {
        ns.run(task);
    }


    let batch = 0;
    const batch_limit = 80000; // Avoid hitting the instance cap (around 400k instances)
    const sleep_every = 2000;
    let remaining_batches = batch_limit;
    let final_pid = 0;
    ns.print("Starting to loop against ", target_name);
    await ns.sleep(100);
    let recalculate = true;
    for (; ;) {
        // TODO: Only reprep if I don't have formulas. Otherwise calculate a batch that self-prepares.
        if (ns.getServerSecurityLevel(target_name) > ns.getServerMinSecurityLevel(target_name) || ns.getServerMoneyAvailable(target_name) < ns.getServerMaxMoney(target_name)) {
            const msg = `Target  ${target_name} isn't prepared: ${ns.getServerSecurityLevel(target_name)} : ${ns.getServerMoneyAvailable(target_name)}`;
            ns.print(msg);
            ns.write("a_completion_listener.txt", msg, 'a');
            await prepare_server(ns, target_name, true);
            recalculate = true;
        }
        if (recalculate) {
            const formulas = ns.fileExists('Formulas.exe');
            target = formulas ? await calculate_target_with_formulas(ns, target_name, hack_percentage) : await calculate_target_without_formulas(ns, target_name, hack_percentage);
            ns.print("  ", target.name, " needs ", target.hack_threads, " hack threads, ", target.hack_weaken_threads, " hack weaken threads, ", target.grow_threads, " grow threads, ", target.grow_weaken_threads, " grow weaken threads, ", ns.formatNumber(target.grow_time / 1000), "s grow time, ", ns.formatNumber(target.hack_time / 1000), "s hack time, ", ns.formatNumber(target.weaken_time / 1000), "s weaken time.");
            recalculate = false;
        }
        for (const server_name of target.server_ram_requirements.keys()) {
            if (remaining_batches <= 0) {
                break;
            }
            ns.print("Queueing on ", server_name);
            let server_batches = 0;
            for (; ;) {
                if (remaining_batches <= 0) {
                    break;
                }
                const server_used_ram = ns.getServerUsedRam(server_name);
                const needed_ram = target.server_ram_requirements.get(server_name) || 0;
                const server = ns.getServer(server_name);
                const server_ram = server.maxRam - server_used_ram;

                const proportion = Math.min(1, server_ram / needed_ram);
                const hack_threads = Math.floor(target.hack_threads * proportion);
                const hack_weaken_threads = Math.floor(target.hack_weaken_threads * proportion);
                const grow_threads = Math.floor(target.grow_threads * proportion);
                const grow_weaken_threads = Math.floor(target.grow_weaken_threads * proportion);
                if (hack_threads > 0 && hack_weaken_threads > 0 && grow_threads > 0 && grow_weaken_threads > 0) {
                    ns.exec('hack_once.js', server_name, { threads: hack_threads, temporary: true }, target.name, target.weaken_time, target.hack_time, port, batch);
                    ns.exec('weaken_once.js', server_name, { threads: hack_weaken_threads, temporary: true }, target.name, target.weaken_time, target.weaken_time, port, batch);
                    ns.exec('grow_once.js', server_name, { threads: grow_threads, temporary: true }, target.name, target.weaken_time, target.grow_time, port, batch);
                    final_pid = ns.exec('weaken_once.js', server_name, { threads: grow_weaken_threads, temporary: true }, target.name, target.weaken_time, target.weaken_time, port, batch);
                    batch++;
                    server_batches++;
                    remaining_batches--;
                    if (remaining_batches % sleep_every == 0) {
                        ns.print("Sleeping after ", sleep_every, " batches queued");
                        await ns.sleep(100);
                    }
                }
                else {
                    // ns.print("Queued ", server_batches, " on ", server_name);
                    break;
                }
            }

        }
        if (batch == 0) {
            ns.print("Not enough RAM to queue any partial batches, quitting.");
            return;
        }
        ns.print(`Queued ${batch_limit - remaining_batches} batches, used all RAM/instances(), sleeping (estimated ${ns.formatNumber(target.weaken_time / 1000)}s).`);
        remaining_batches = batch_limit;
        while (ns.isRunning(final_pid)) {
            await ns.sleep(1000);
        }
        await ns.sleep(1000);
    }
}

// TODO: Align prepare so the grow and weaken threads complete (almost) together
// TODO: Work out why only home is getting utilised