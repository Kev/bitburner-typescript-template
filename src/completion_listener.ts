import { NS } from "@ns";
import { colours } from "./base";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.tail();
    const port = ns.args[0] as number;
    const filename = `completion_listener_${port}_${new Date().toISOString()}.txt`;
    ns.write(filename, "[");
    for (;;) {
        const message = await ns.readPort(port);
        if (message == 'NULL PORT DATA') {
            await ns.sleep(10);
            continue;
        }
        ns.write(filename, `${message as string},\n`, 'a');
        const json = JSON.parse(message as string);
        // ns.print(`Received message: ${message}`);
        // { what: port_text, target: target, delay: delay, completion: Date.now(), runner: ns.getHostname(), script_start_time: script_start_time, function_start_time: function_start_time, target_end_time: target_end_time }
        ns.print(`Received message: ${colours.cyan} ${json.what} ${json.target} ${colours.reset}delay ${json.delay} on ${json.runner} ${colours.yellow} Completed ${new Date(json.completion).toISOString() } aim ${ new Date(json.target_end_time).toISOString()  } ${ colours.reset }started ${ colours.white } ${ /*new Date(json.script_start_time).toISOString() */'' } ${ new Date(json.function_start_time).toISOString() }  ${colours.reset}`);
    }
}
