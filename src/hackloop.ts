import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
    const server = ns.args[0] as string;
    const min_sec = ns.getServerMinSecurityLevel(server);
    const max_cash = ns.getServerMaxMoney(server);

    const sec_buffer = 1;
    const cash_reserve = 0.75;

    ns.print("Running against server ", server);

    for (;;) {
        const sec = ns.getServerSecurityLevel(server);
        ns.print("Security level ", sec, " target <= ", min_sec + sec_buffer);
        const money = ns.getServerMoneyAvailable(server);
        ns.print("Money available ", money, " target >= ", max_cash * cash_reserve);
        if (sec > min_sec + sec_buffer) {
            await ns.weaken(server);
        } else if (money < max_cash * cash_reserve) {
            await ns.grow(server);
        } else {
            await ns.hack(server);
        }
    }

}