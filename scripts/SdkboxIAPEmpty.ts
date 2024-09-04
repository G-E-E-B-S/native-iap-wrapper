import { IAPProduct } from "./IAPDefinitions";
import { IAPListener, IPurchase, ISdkboxIAP } from "./ISdkboxIAP";

export class SdkboxIAPEmpty implements ISdkboxIAP {
    initPlayPass(noAdsPackId: string): void {
        console.log("initPlayPass %s", noAdsPackId);
    }
    queryUnconsumedPurchases(): void {
        console.log("queryUnconsumedPurchases");
    }
    onConsumed(product: IAPProduct): void {
        console.log("onConsumed %s", JSON.stringify(product));
    }
    onConsumeFailure(product: IAPProduct, errorMsg: string, errorCode: number): void {
        console.log("onConsumeFailure P: %s, EM: %s, EC: %S", JSON.stringify(product), errorMsg, errorCode);
    }
    getProducts(): Promise<IPurchase[]> {
        return Promise.resolve([]);
    }
    consumePurchase(): Promise<boolean> {
        return Promise.resolve(true);
    }
    init() {
        // no-op
    }

    isEnabled(): boolean {
        return false;
    }

    setListener(listener_: IAPListener) {
        // no-op
    }

    purchase(packID: string) {
        
    }

    refresh() {
        
    }

    onServerSuccess(token: any) {
        
    }
}

