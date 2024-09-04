import { IAPPurchaseProduct, IAPProductBase, IAPProduct, BillingResponseCode } from "../IAPDefinitions";
import { IAPListener, IPurchase, ISdkboxIAP } from "../ISdkboxIAP";
declare module sdkbox {
    class IAPInterface {
        initPlayPass(noAdsPackId: string): void;
        consume(productId: string, token: string): void;
        isEnabled(): boolean;
        init(): void;
        setListener(listener: IAPListener): void;
        refresh(): void;
        purchase(packID: string): void;
        queryPurchases(): void;
        queryUnconsumedPurchases(): void;
    }
    export const IAP: IAPInterface;
}
export class NativeIAP implements ISdkboxIAP, IAPListener {
    private listener: IAPListener;
    private queryPurchaseSuccessCallback: (products: IAPPurchaseProduct[]) => void;
    private queryPurchaseFailureCallback: (errorCode: number, msg: string) => void;
    private consumeSuccessCallbackMap: {[index: string]: (product: IAPPurchaseProduct) => void} = {};
    private consumeFailureCallbackMap: {[index: string]: (error: BillingResponseCode) => void} = {};

    initPlayPass(noAdsPackId: string): void {
        sdkbox.IAP.initPlayPass(noAdsPackId);
    }

    init(): void {
        sdkbox.IAP.init();
    }
    setListener(listener: IAPListener): void {
        this.listener = listener;
        sdkbox.IAP.setListener(this);
    }
    isEnabled(): boolean {
        return sdkbox.IAP.isEnabled();
    }
    refresh(): void {
        sdkbox.IAP.refresh();
    }
    purchase(packID: string): void {
        sdkbox.IAP.purchase(packID);
    }
    onServerSuccess(token: any): void {
        // no-op
    }
    consumePurchase(productId: string, purchaseToken: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.consumeSuccessCallbackMap[productId] = () => {
                console.log("Consumed purchase %s", productId);
                resolve(true);
            }
            this.consumeFailureCallbackMap[productId] = (errorCode: BillingResponseCode) => {
                console.error("Consumed purchase failure %s, err: %s", productId, errorCode);
                reject(errorCode);
            }
            sdkbox.IAP.consume(productId, purchaseToken);
        });
    }
    getProducts(): Promise<IPurchase[]> {
        console.log("Getting products");
        return new Promise((resolve, reject) => {
            this.queryPurchaseSuccessCallback = (products) => {
                console.log("Got products %s", JSON.stringify(products));
                // TODO: fix naming of fields from native lib
                resolve(products.map((product => {
                    return {
                        token: product.id,
                        id: product.id,
                    };
                })));
            }
            this.queryPurchaseFailureCallback = (errorCode, msg) => {
                console.error("Got products error code: %s, msg: %s", errorCode, msg);
                reject(msg);
            }
            sdkbox.IAP.queryPurchases();
        });
    }
    queryUnconsumedPurchases(): void {
        console.log("store queryUnconsumedPurchases");
        sdkbox.IAP.queryUnconsumedPurchases();
    }
    onInitialized(success: boolean): void {
        this.listener.onInitialized(success);
    }
    onSuccess(product: IAPPurchaseProduct): void {
        this.listener.onSuccess(product);
    }
    onFailure(product: IAPProductBase, errorMsg: string, errorCode: number): void {
        this.listener.onFailure(product, errorMsg, errorCode);
    }
    onCanceled(product: IAPProductBase): void {
        this.listener.onCanceled(product);
    }
    onRestored(product: IAPProduct): void {
        this.listener.onRestored(product);
    }
    onRestoreFailure(product: IAPProduct, errorMsg: string, errorCode: number): void {
        console.log("restrore failed: ", errorCode, errorMsg);
    }
    onProductRequestSuccess(products: IAPProduct[]): void {
        this.listener.onProductRequestSuccess(products);
    }
    onProductRequestFailure(msg: string): void {
        this.listener.onProductRequestFailure(msg);
    }
    onConsumed(product: IAPPurchaseProduct) {
        if (this.consumeSuccessCallbackMap[product.id]) {
            this.consumeSuccessCallbackMap[product.id](product);
            this.consumeSuccessCallbackMap[product.id] = null;
        };
    };
    onConsumeFailure(product: IAPProduct, errorMsg: string, errorCode: number): void {
        if (this.consumeFailureCallbackMap[product.id]) {
            this.consumeFailureCallbackMap[product.id](errorCode);
            this.consumeFailureCallbackMap[product.id] = null;
        }    
    }
    onQueryPurchasesSuccess(products: IAPPurchaseProduct[]) {
        if (this.queryPurchaseSuccessCallback) {
            this.queryPurchaseSuccessCallback(products);
        }
    };
    onQueryPurchasesFailure(errorCode: number, msg: string) {
        if (this.queryPurchaseFailureCallback) {
            this.queryPurchaseFailureCallback(errorCode, msg);
        }
    };
    onPlayPassStatusUpdate(active: boolean, token: string): void {
        console.log("play pass status update", active, token);
        this.listener.onPlayPassStatusUpdate(active, token);
    }
    onUnConsumedProductsUpdate(products: IAPProduct[]): void {
        this.listener.onUnConsumedProductsUpdate(products);
    }
}