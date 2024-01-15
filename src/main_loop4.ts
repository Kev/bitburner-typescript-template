import { NS } from "@ns";
import { best_targets_uncached, cached_servers, farm_out, hwgw, rooted, wait_for } from "base";

class TargetCalculation {
    name = '';
    hack_threads!: number;
    hack_weaken_threads!: number;
    grow_threads!: number;
    grow_weaken_threads!: number;
    grow_time!: number;
    hack_time!: number;
    weaken_time!: number;
    hack_delay!: number;
    grow_delay!: number;
    server_ram_requirements!: Map<string, number>;
}

async function calculate_target(ns: NS, target: string, hack_percentage: number): Promise<TargetCalculation> {
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
    const hack_delay = Math.floor(weaken_time - hack_time);
    const grow_delay = Math.floor(weaken_time - grow_time);

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
        hack_delay: hack_delay,
        grow_delay: grow_delay,
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

    const targets = best_targets_uncached(ns, num_servers);
    ns.print("Targets: ", targets.join(", "));
    ns.run('monitor.js', 1, ...targets);
    const prepare_pids = [];
    for (const target of targets) {
        prepare_pids.push(ns.run("prepare.js", 1, target));
    }
    ns.print("Waiting for prepare to finish.");
    await wait_for(ns, prepare_pids);
    ns.print("Calculating target threads");
    const target_calculations: Array<TargetCalculation> = [];
    for (const target of targets) {
        target_calculations.push(await calculate_target(ns, target, hack_percentage));
    }

    const hwgw_ram = ns.getScriptRam('hwgw.js');
    let last_now = performance.now();
    const home_ram = ns.getServerMaxRam('home');
    for (; ;) {
        for (const target of target_calculations) {
            for (const server_name of target.server_ram_requirements.keys()) {
                const server_used_ram = ns.getServerUsedRam(server_name);
                const needed_ram = target.server_ram_requirements.get(server_name) || 0;
                const server = ns.getServer(server_name);

                const server_ram = server.maxRam - server_used_ram;
                if (server_ram < needed_ram && server_used_ram > 0) {
                    // Skip servers that can't fit a full batch in, unless they're empty, in which case assign a partial batch to max the RAM
                    continue;
                }
                const proportion = Math.min(1, server_ram / needed_ram);
                const hack_threads = Math.floor(target.hack_threads * proportion);
                const hack_weaken_threads = Math.floor(target.hack_weaken_threads * proportion);
                const grow_threads = Math.floor(target.grow_threads * proportion);
                const grow_weaken_threads = Math.floor(target.grow_weaken_threads * proportion);
                if (hack_threads > 0 && hack_weaken_threads > 0 && grow_threads > 0 && grow_weaken_threads > 0) {
                    while (home_ram - ns.getServerUsedRam('home') < hwgw_ram) {
                        await ns.sleep(5);
                    }
                    await hwgw(ns, server_name, hack_threads, hack_weaken_threads, grow_threads, grow_weaken_threads, target.name, target.hack_delay, target.grow_delay);
                    await ns.sleep(0);
                    // await ns.sleep(1);
                }
                // await ns.sleep(0);
            }
        }
        await ns.sleep(0);
        const now = performance.now();
        await ns.sleep(Math.min(10, Math.max(0, now - last_now)));
        last_now = performance.now();
    }
}


// TODO: Align jobs so that they never start at the time another is finishing. Either time-aligning (all finish on even seconds/launch on odd seconds) or ns.portHandle().nextWrite() to ensure all four are launched not between other fours.
// TODO: Use RunOptions to make HGW temporary ns.exec(weak, host, { threads: weakRatio1, temporary: true }, target, (offset)); https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.ns.exec.md
// TODO: Launch the calculations in parallel
// TODO: If formulas is available, use it to calculate the number of threads needed to hack/grow a server