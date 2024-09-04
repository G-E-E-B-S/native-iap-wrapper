import { IAPProduct, IAPProductBase, IAPPurchaseProduct } from "./IAPDefinitions";
export interface IPurchase {
    token: string;
    id: string,
}
export interface IAPListener {
    onInitialized(success: boolean): void;
    onSuccess(product: IAPPurchaseProduct): void;
    onFailure(product: IAPProductBase, errorMsg: string| {message: string}, errorCode: number): void;
    onCanceled(product: IAPProductBase): void;
    onRestored(product: IAPProduct): void;
    onRestoreFailure(product: IAPProduct, errorMsg: string, errorCode: number): void;
    onProductRequestSuccess(products: IAPProduct[]): void;
    onProductRequestFailure(msg: string): void;
    onPlayPassStatusUpdate(active: boolean, token: string): void;
    onUnConsumedProductsUpdate(products: IAPProduct[]): void;
}

export interface ISdkboxIAP {
    init(): void;
    initPlayPass(noAdsPackId: string): void;
    setListener(listener_: IAPListener): void;
    isEnabled(): boolean;
    refresh(): void;
    purchase(packID: string): void;
    onServerSuccess(token): void;
    consumePurchase(productId: string, token: string): Promise<boolean>;
    getProducts(): Promise<IPurchase[]>
    queryUnconsumedPurchases(): void;
    onConsumed(product: IAPProduct): void;
    onConsumeFailure(product: IAPProduct, errorMsg: string, errorCode: number): void;
}
