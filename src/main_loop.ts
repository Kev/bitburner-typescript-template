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
    for (;;) {
        ns.print("Spread start");
        const hack_script = 'hackloop.script';
        const scripts: Array<string> = [hack_script, 'just_hack.js', 'just_weaken.js', 'just_grow.js'];

        const to_scan: Array<string> = ['home'];
        const scanned: Array<string> = [];
        const rooted: Array<string> = ['home'];

        const hacking_level: number = ns.getHackingLevel();
        const port_hacks: Array<string> = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
        const available_port_hacks: Array<string> = port_hacks.filter(port_hack => ns.fileExists(port_hack))
        const num_ports_possible: number = available_port_hacks.length;

        // let highest_value :Number= 0;
        // let highest_value_host :String= '';

        while (to_scan.length > 0) {
            // ns.print("Previously scanned hosts: " + scanned);
            // ns.print("Remaining to scan: " + to_scan);
            const host : string = to_scan.pop()  || '';
            const adjacents : Array<string> = await ns.scan(host);
            // ns.print("Starting scan with host ", host, " with adjacents ", adjacents);
            scanned.push(host);
            for (const adjacent of adjacents) {
                // ns.print("Considering adjacent '", adjacent, "' against scanned: ", scanned);
                if (string_in(adjacent, scanned)) {
                    // ns.print("Skipping, already scanned");
                    continue;
                }
                // ns.print("Proceeding");
                if (!ns.hasRootAccess(adjacent)) {
                    ns.print(adjacent + " doesn't have root");
                    if (ns.getServerRequiredHackingLevel(adjacent) <= hacking_level && ns.getServerNumPortsRequired(adjacent) <= num_ports_possible) {
                        ns.print("Rooting");
                        if (string_in('BruteSSH.exe', available_port_hacks)) {
                            ns.print("Running brute ssh");
                            await ns.brutessh(adjacent);
                        }
                        if (string_in('FTPCrack.exe', available_port_hacks)) {
                            ns.print("Running ftp crack");
                            await ns.ftpcrack(adjacent);
                        }
                        if (string_in('relaySMTP.exe', available_port_hacks)) {
                            ns.print("Running relay smtp");
                            await ns.relaysmtp(adjacent);
                        }
                        if (string_in('HTTPWorm.exe', available_port_hacks)) {
                            ns.print("Running http worm");
                            await ns.httpworm(adjacent);
                        }
                        if (string_in('SQLInject.exe', available_port_hacks)) {
                            ns.print("Running sql inject");
                            await ns.sqlinject(adjacent);
                        }
                        ns.print("Nuking ");
                        await ns.nuke(adjacent);
                    }
                }
                if (ns.hasRootAccess(adjacent) && !(string_in(adjacent, rooted))) {
                    // ns.print("Has root");
                    rooted.push(adjacent);
                    to_scan.push(adjacent);
                    // let max_money = ns.getServerMaxMoney(adjacent);
                    // if (max_money > highest_value) {
                    //     highest_value = max_money;
                    //     highest_value_host = adjacent;
                    // }
                    for (const script of scripts) {
                        ns.scp(script, adjacent, 'home');
                    }
                }
            }
        }
        await ns.sleep(1000);

        // ns.print("Host with highest value (", highest_value, "): ", highest_value_host);

        const highest_value_host  = hacking_level >= 170 ? 'phantasy' : 'joesguns';

        const kill: boolean = ns.args.length > 0 && string_in('kill', ns.args.map(String));
        const no_run: boolean = ns.args.length > 0 && string_in('kill', ns.args.map(String));

        for (const server of rooted) {
            ns.print("Starting scripts on ", server);
            if (kill) {
                ns.print("Killing ", server);
                await ns.killall(server);
            }
            if (no_run) {
                ns.print("Not running scripts");
                continue;
            }
            const script_mem : number = ns.getScriptRam(hack_script, server);
            const server_mem : number = ns.getServerMaxRam(server);
            const saved : number = server == "home" ? 10000 : 0;
            for (const multiple of [400, 200, 100, 50, 20, 10, 5, 2, 1]) {
                while (server_mem - ns.getServerUsedRam(server) - saved> script_mem * multiple) {
                    ns.print("Remaining mem = ", server_mem - ns.getServerUsedRam(server), " script mem = ", script_mem, ", so running another copy at t=", multiple);
                    ns.exec(hack_script, server, multiple, highest_value_host);
                    await ns.sleep(1000); // This sleep means that all the scripts start at staggered times, and across hundreds (thousands?) of scripts, that's going to reduce the number of times that they run redundant grow/weaken cycles at the same time. I hope.
                }
            }
            await ns.sleep(100);
        }
        await ns.sleep(10000);
    }
}





