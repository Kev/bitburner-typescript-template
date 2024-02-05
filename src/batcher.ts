import { NS, Player } from "@ns";
import { farm_out, grow_security, hack_security, prepare_server, wait_for, weaken_security } from "base";
import { State, get_state } from "./singularity";
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

async function calculate_target_with_formulas(ns: NS, target: string, hack_percentage: number, mutable_player: Player, state: State): Promise<TargetCalculation> {
    const simulated_server = ns.getServer(target);
    simulated_server.hackDifficulty = simulated_server.minDifficulty;
    simulated_server.moneyAvailable = simulated_server.moneyMax ?? 0;
    const const_player = ns.getPlayer();

    const per_thread_hack_amount = ns.formulas.hacking.hackPercent(simulated_server, mutable_player);
    const hack_threads = Math.ceil(hack_percentage / per_thread_hack_amount);

    simulated_server.moneyAvailable = ((simulated_server.moneyMax ?? 0) * (1 - hack_threads * per_thread_hack_amount)) * 0.95; // Assume an extra 5% off to help with not getting desynched
    // ns.print(target, " simulating ", ns.formatNumber(simulated_server.moneyAvailable), "/", ns.formatNumber(simulated_server.moneyMax ?? 0), " money after ", hack_threads, " hack threads");

    mutable_player.exp.hacking += ns.formulas.hacking.hackExp(simulated_server, mutable_player) * hack_threads;

    const hack_weaken_threads = Math.ceil(hack_threads * hack_security / weaken_security);

    mutable_player.exp.hacking += ns.formulas.hacking.hackExp(simulated_server, mutable_player) * hack_weaken_threads;

    const grow_threads = Math.ceil(ns.formulas.hacking.growThreads(simulated_server, mutable_player, simulated_server.moneyMax ?? 0));

    mutable_player.exp.hacking += ns.formulas.hacking.hackExp(simulated_server, mutable_player) * grow_threads;

    const grow_weaken_threads = Math.ceil(grow_threads * grow_security / weaken_security);

    mutable_player.exp.hacking += ns.formulas.hacking.hackExp(simulated_server, mutable_player) * grow_weaken_threads;

    const servers = state.rooted;
    const server_ram_requirements: Map<string, number> = new Map<string, number>();
    for (const server of servers) {
        const needed = calculate_needed_ram(ns, server, hack_threads, hack_weaken_threads, grow_threads, grow_weaken_threads);
        // if (needed < ns.getServerMaxRam(server)) {
        server_ram_requirements.set(server, needed);
        // ns.print("  ", server, " needs ", ns.formatRam(needed), " RAM for a full batch against ", target, ".");
        // } else {
        //     ns.print("Not including ", server, " in calculations for ", target, " because it doesn't have enough RAM (", ns.formatRam(ns.getServerMaxRam(server)), "/", ns.formatRam(needed), ").");
        // }

    }

    const grow_time = ns.formulas.hacking.growTime(simulated_server, const_player);
    const hack_time = ns.formulas.hacking.hackTime(simulated_server, const_player);
    const weaken_time = ns.formulas.hacking.weakenTime(simulated_server, const_player);

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

async function calculate_target_without_formulas(ns: NS, target: string, hack_percentage: number, state: State): Promise<TargetCalculation> {
    ns.print("Calculating target ", target, " with hack percentage ", hack_percentage);
    await prepare_server(ns, target, true);
    let server = ns.getServer(target);
    const max_money = server.moneyMax || 0;
    const hack_amount = max_money * hack_percentage;
    const full_hack_threads = Math.floor(ns.hackAnalyzeThreads(target, hack_amount));
    const hack_security_increase = full_hack_threads * hack_security;
    const full_hack_weaken_threads = Math.ceil(hack_security_increase / weaken_security) + 1; // +1 in case of float rounding errors
    const hack_pids = await farm_out(ns, 'hack_once.js', full_hack_threads, target);
    const hack_security_pids = await farm_out(ns, 'weaken_once.js', full_hack_weaken_threads, target);
    await wait_for(ns, hack_pids);
    await wait_for(ns, hack_security_pids);
    server = ns.getServer(target);
    ns.print("  After executing initial hack threads, security is ", ns.formatNumber(server.hackDifficulty || 0), " and money is ", ns.formatNumber(server.moneyAvailable || 0), " of an expected ", ns.formatNumber(max_money * (1 - hack_percentage)));

    const grow_multiplier = 1 / (1 - hack_percentage);
    const full_grow_threads = Math.ceil(ns.growthAnalyze(target, grow_multiplier) * 1.05); // Adding 5% to account for levelling up
    const grow_security_increase = full_grow_threads * grow_security;
    const full_grow_weaken_threads = Math.ceil(grow_security_increase / weaken_security) + 1; // +1 in case of float rounding errors
    const grow_pids = await farm_out(ns, 'grow_once.js', full_grow_threads, target);
    const grow_security_pids = await farm_out(ns, 'weaken_once.js', full_grow_weaken_threads, target);
    await wait_for(ns, grow_pids);
    await wait_for(ns, grow_security_pids);
    server = ns.getServer(target);
    ns.print("  After executing initial grow threads, security is ", ns.formatNumber(server.hackDifficulty || 0), " and money is ", ns.formatNumber(server.moneyAvailable || 0));

    ns.print("  Using hack proportion of ", hack_percentage, " and growth multiplier of ", grow_multiplier)



    const grow_time = ns.getGrowTime(target);
    const hack_time = ns.getHackTime(target);
    const weaken_time = ns.getWeakenTime(target);

    const servers = state.rooted;
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
    const hack_percentage = 0.3;
    const state: State = get_state(ns);
    // while (!state.hack_server) {
    //     ns.tprint("No hack server set, aborting.");
    //     await ns.sleep(100000);
    // }

    let target!: TargetCalculation;
    const port = 1; // I don't need this any more, but don't want to break old scripts by changing API to not include it

    // Forces precompilation, avoiding timing issues later
    for (const task of ['hack_once.js', 'weaken_once.js', 'grow_once.js']) {
        ns.exec(task, 'home');
    }

    const start_time = Date.now();

    let batch = 0;
    const batch_limit = 80000; // Avoid hitting the instance cap (around 400k instances)
    const sleep_every = 2000;
    let remaining_batches = batch_limit;
    let final_pid = 0;
    ns.print("Starting to loop against ", state.hack_server);
    let recalculate = true;
    let last_hacking_level = 0;
    for (; ;) {
        // TODO: Only reprep if I don't have formulas. Otherwise calculate a batch that self-prepares if I have enough RAM.
        // TODO: If I have formulas, reevaluate the best target each iteration, and start prepping it async if there's a new one that's better (but not too often) until it's ready. Run batches against the previous server until new one is ready.
        {
            const server = ns.getServer(state.hack_server);
            if ((server.hackDifficulty || 0) > (server.minDifficulty || 0) || (server.moneyAvailable || 0) < (server.moneyMax || 0)) {
                const msg = `Target  ${state.hack_server} isn't prepared: ${(server.hackDifficulty || 0)} : ${server.moneyAvailable || 0}`;
                ns.print(msg);
                // ns.write("a_completion_listener.txt", msg, 'a');
                await prepare_server(ns, state.hack_server, true);
                recalculate = true;
            }
        }

        if (ns.getPlayer().exp.hacking > last_hacking_level) {
            last_hacking_level = ns.getPlayer().exp.hacking;
            recalculate = true;
        }

        if (recalculate) {
            const formulas = ns.fileExists('Formulas.exe');
            // TODO: Do the calculations with a consistent Player object, so that levelups are accounted for in advance
            target = formulas ? await calculate_target_with_formulas(ns, state.hack_server, hack_percentage, ns.getPlayer(), state) : await calculate_target_without_formulas(ns, state.hack_server, hack_percentage, state);
            ns.print("  ", target.name, " needs ", target.hack_threads, " hack threads, ", target.hack_weaken_threads, " hack weaken threads, ", target.grow_threads, " grow threads, ", target.grow_weaken_threads, " grow weaken threads, ", ns.formatNumber(target.grow_time / 1000), "s grow time, ", ns.formatNumber(target.hack_time / 1000), "s hack time, ", ns.formatNumber(target.weaken_time / 1000), "s weaken time.");
            recalculate = formulas; // calculating with formulas is cheap, so may as well do it every time
        }

        const mutable_calculation_player = ns.getPlayer();
        const pids: Array<number> = [];
        for (const server_name of target.server_ram_requirements.keys()) {
            if (remaining_batches <= 0) {
                break;
            }
            ns.print("Queueing on ", server_name);
            for (; ;) {
                if (remaining_batches <= 0) {
                    break;
                }

                if (recalculate) {
                    // If we're still `recalculate` at this point, we must have formulas.
                    target = await calculate_target_with_formulas(ns, state.hack_server, hack_percentage, mutable_calculation_player, state);
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
                    pids.push(ns.exec('hack_once.js', server_name, { threads: hack_threads, temporary: true }, target.name, target.weaken_time, target.hack_time, port, batch));
                    pids.push(ns.exec('weaken_once.js', server_name, { threads: hack_weaken_threads, temporary: true }, target.name, target.weaken_time, target.weaken_time, port, batch));
                    pids.push(ns.exec('grow_once.js', server_name, { threads: grow_threads, temporary: true }, target.name, target.weaken_time, target.grow_time, port, batch));
                    final_pid = ns.exec('weaken_once.js', server_name, { threads: grow_weaken_threads, temporary: true }, target.name, target.weaken_time, target.weaken_time, port, batch);
                    pids.push(final_pid);
                    batch++;
                    remaining_batches--;
                    if (remaining_batches % sleep_every == 0) {
                        ns.print("Sleeping after ", sleep_every, " batches queued");
                        await ns.sleep(remaining_batches % 10000 == 0 ? 50 : 1);
                    }
                }
                else {
                    break;
                }
            }

        }
        if (batch == 0) {
            ns.print("Not enough RAM to queue any partial batches against ", target.name, ", trying to farm out.");
            await farm_out(ns, 'hack_once.js', target.hack_threads, target.name);
            await farm_out(ns, 'grow_once.js', target.grow_threads, target.name);
            const pids = await farm_out(ns, 'weaken_once.js', target.grow_weaken_threads + target.hack_weaken_threads, target.name);
            final_pid = pids[pids.length - 1];
        }
        ns.print(`Queued ${batch_limit - remaining_batches} batches, used all RAM/instances(), sleeping (estimated ${ns.formatNumber(target.weaken_time / 1000)}s).`);
        remaining_batches = batch_limit;
        while (ns.isRunning(final_pid)) {
            await ns.sleep(1000);
        }
        await wait_for(ns, pids);
        await ns.sleep(1000);
        const hack_skill = ns.getHackingLevel();
        // Perform various checks to see if we should return control to the auto scripts
        if (ns.fileExists('Formulas.exe')) return; // If we have formulas, restarting is cheap unless we switch servers
        if (state.hack_server == 'n00dles' && hack_skill > 20 && ns.hasRootAccess('joesguns')) {
            return;
        }
        if (state.hack_server == 'joesguns' && hack_skill > 200 && ns.hasRootAccess('phantasy')) {
            return;
        }
        if (start_time + 1800 < Date.now()) {
            // Even if we're not ready to switch servers, return control every 30mins
            return;
        }
    }
}
