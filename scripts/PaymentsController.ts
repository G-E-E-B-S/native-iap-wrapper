
import { Dictionary } from "typescript-collections";
import {
    BillingResponseCode, IAPProduct, IAPProductBase, IAPPurchaseProduct, IPurchaseRequest,
    IResponse, PurchaseEventData, StoreEvent, StorePackData
} from "./IAPDefinitions";
import { IPurchase, ISdkboxIAP } from "./ISdkboxIAP";


export enum SdkState {
    SdkNotSetup = 0,
    SdkSettingUp = 1,
    SdkSetup = 2,
    SdkSetupFail = 3,
    FetchingPackages = 4,
    PackagesFetched = 5,
    PackagesFetchFailed = 6,
    PackagesFetching = 7,
}
export enum PurchaseFlowState {
    Idle = 0,
    PurchaseStart = 1,
    ServerPurchaseStart = 2,
    ServerPurchaseFailed = 3,
    ConsumeStart = 4,
    ConsumeFailed = 5
}
export enum PurchaseErrorCodes {
    ClientFailed = "client_failed",
    Cancelled = "cancelled",
    DuplicateOrder = "duplicate_order",
    NoPurchaseFound = "no_purchase_found",
    PackNotFound = "pack_not_found",
    ConnectionFailed = "connection_failed",
    ConsumeFailed = "consume_failed"
}
export const PurchaseErrorToMsgMap = {
}
PurchaseErrorToMsgMap[PurchaseErrorCodes.DuplicateOrder] = "duplicate_purchase";
PurchaseErrorToMsgMap[PurchaseErrorCodes.PackNotFound] = "pack_not_found";
PurchaseErrorToMsgMap[PurchaseErrorCodes.ClientFailed] = "wrong";
PurchaseErrorToMsgMap[PurchaseErrorCodes.ConnectionFailed] = "connect_failed";
PurchaseErrorToMsgMap[PurchaseErrorCodes.NoPurchaseFound] = "purchase_not_found";
PurchaseErrorToMsgMap[PurchaseErrorCodes.Cancelled] = "user_cancel_pay";
PurchaseErrorToMsgMap[PurchaseErrorCodes.ConsumeFailed] = "consume_failed";

export type EventParams = { [index: string]: string | number };
export interface IAPDependency {
    sendPostRequest(address: string, body: string, callback: (success: boolean, data: IResponse) => void): void;
    logCustomEvent(name: string, params?: EventParams);
    loadStoreData(): Promise<Array<StorePackData>>;
    onPlayPassStatusUpdated(isActive: boolean);
}
enum PurchaseStages {
    Start = "start",
    ClientSuccess = "client_success",
    Failed = "failed",
    Restored = "restored",
    ServerStart = "server_start",
    ServerSuccess = "server_success",
    Cancelled = "cancelled",
    ConsumeSuccess = "consume_success",
    ConsumeFailed = "consume_failed",
}
const SilentPurchaseStageSuffix = "_silent";
const RetryPurchaseStageSuffix = "_retry";
export interface PurchaseResponse {
    error: string,
    packID: string,
    extraError?: string,
    receipt?: string,
    signature?: string,
    rewardCoins?: string,
    finalCoins?: number
}
export type PaymentCallback = (PurchaseResponse) => void;
export enum PackageType {
    InApp = "inapp",
    Subs = "subs"
}

export interface PaymentsConfig {
    userId: string;
    isDebug: boolean,
    osName: string,
    purchaseApiEndpoint: string,
}
enum TrackingEvents {
    SdkboxPackageFetchFailed = "pacakge_fetch_failed",
    ServerPurchaseSuccess = "server_purchase_success",
    PurchaseVirtualCurrency = "PurchaseVirtualCurrency"
}
const BACKOFF_TIME_STEP = 10 * 1000;
const MAX_BACKOFF_TIME = 30 * BACKOFF_TIME_STEP;

export class PaymentsController {
    protected packData: Array<StorePackData> = [];
    protected packMap: Dictionary<string, StorePackData> = new Dictionary();
    protected eventDispatcher: cc.EventTarget;
    protected currentSdkState: SdkState = SdkState.SdkNotSetup;
    protected currentPurchaseState: PurchaseFlowState = PurchaseFlowState.Idle;
    protected retryCount: number;
    protected config: PaymentsConfig;
    protected requestor: IAPDependency;
    protected playPassActive = false;
    protected noAdsPurchaseToken: string;
    private iapLib: ISdkboxIAP;
    private consumeWaitProduct: IAPPurchaseProduct;
    private consumeWaitEvent: cc.Event.EventCustom;
    private failedServerPurchaseProduct: IAPPurchaseProduct;
    private productsGrantedSilently: PurchaseEventData[] = [];

    constructor(config: PaymentsConfig, iapLib: ISdkboxIAP, requestor: IAPDependency, playPassPackId?: string) {
        this.iapLib = iapLib;
        this.config = config;
        this.requestor = requestor;
        this.retryCount = 0;
        this.eventDispatcher = new cc.EventTarget();
        this.startSetup();
        this.setupListeners();
        this.iapLib.init();
        if (playPassPackId) {
            this.iapLib.initPlayPass(playPassPackId);
        }
    }

    isStoreAvailable(): boolean {
        return this.iapLib.isEnabled();
    }
    initiatePurchaseFlow(packID: string): void {
        this.consumeWaitEvent = null;
        this.consumeWaitProduct = null;
        this.failedServerPurchaseProduct = null;
        this.currentPurchaseState = PurchaseFlowState.PurchaseStart;
        this.logPurchaseEvent(packID, PurchaseStages.Start);
        this.iapLib.purchase(packID);
        const event = new cc.Event.EventCustom(StoreEvent.PurchaseStart, true);
        event.setUserData(packID);
        this.getEventDispatcher().dispatchEvent(event);
    }
    getPurchases(): Promise<IPurchase[]> {
        return this.iapLib.getProducts();
    }
    consumePurchase(productId: string, purchaseToken: string): Promise<boolean> {
        return this.iapLib.consumePurchase(productId, purchaseToken);
    }
    retryPurchaseFlow() {
        if (this.currentPurchaseState == PurchaseFlowState.ServerPurchaseFailed &&
            this.failedServerPurchaseProduct) {
            this.purchaseServerTransaction(this.failedServerPurchaseProduct, RetryPurchaseStageSuffix);
        } else if (this.currentPurchaseState == PurchaseFlowState.ConsumeFailed &&
            this.consumeWaitProduct) {
            this.consumePurchase(this.consumeWaitProduct.id, this.consumeWaitProduct.purchaseToken).then(() => {
                this.onPurchaseFlowConsumeSuccess(RetryPurchaseStageSuffix);
            }).catch((errorCode: BillingResponseCode) => {
                this.onPurchaseFlowConsumeFailed(errorCode, RetryPurchaseStageSuffix);
            });
        }
    }
    queryUnconsumedPurchases(): void {
        this.iapLib.queryUnconsumedPurchases();
    }
    packagesReady(): boolean {
        return this.currentSdkState == SdkState.PackagesFetched;
    }
    packagesFailed(): boolean {
        return this.currentSdkState == SdkState.PackagesFetchFailed;
    }
    getCurrentState() {
        return this.currentSdkState;
    }
    getPacks() {
        return this.packData;
    }
    getPackData(packID: string): StorePackData {
        return this.packMap.getValue(packID);
    }
    isPlayPassActive(): boolean {
        return this.playPassActive;
    }
    getNoAdsPurchaseToken(): string {
        return this.noAdsPurchaseToken;
    }
    getEventDispatcher() {
        return this.eventDispatcher;
    }
    containsPack(packID: string): boolean {
        return this.packMap.containsKey(packID);
    }
    setPack(packID: string, pack: StorePackData): void {
        this.packMap.setValue(packID, pack);
    }
    getProductsGrantedSilently(): PurchaseEventData[] {
        return this.productsGrantedSilently;
    }
    clearProductsGrantedSilently(): PurchaseEventData[] {
        const products = this.productsGrantedSilently;
        this.productsGrantedSilently = [];
        return products;
    }
    isPurchaseFlowInProgress(): boolean {
        return this.currentPurchaseState == PurchaseFlowState.PurchaseStart ||
            this.currentPurchaseState == PurchaseFlowState.ServerPurchaseStart ||
            this.currentPurchaseState == PurchaseFlowState.ConsumeStart;
    }

    private setupListeners() {
        this.iapLib.setListener({
            onInitialized: (success) => {
                console.log("iap initialized: ", success);
                if (success) {
                    this.onInitialized();
                    this.requestor.loadStoreData().then((data) => {
                        this.packData = data;
                        this.startPackageFetch();
                    }).catch(err => {
                        this.logInitError(err);
                    });
                } else {
                    this.logInitError(null);
                }
            },
            onSuccess: (product) => {
                //Purchase success
                this.printProduct(product);
                this.logPurchaseEvent(product.id, PurchaseStages.ClientSuccess);
                this.purchaseServerTransaction(product);
                console.log("purchase::onSuccess", product.id);
            },
            onFailure: (product, msg, errorCode) => {
                //Purchase failed
                //msg is the error message
                console.log("purchase::onFailure: ", product.id, msg);
                console.error("purchase::onFailure- ", product.id, errorCode);
                this.onPurchaseFailedOnClient(product, msg);
            },
            onCanceled: (product) => {
                //Purchase was canceled by user
                console.log("purchase::onCanceled", product);
                this.onPurchaseCancelledOnClient(product);
            },
            onRestored: (product: IAPPurchaseProduct) => {
                //Purchase restored
                this.printProduct(product);
                this.logPurchaseEvent(product.id, PurchaseStages.Restored);
                this.purchaseServerTransaction(product);
                console.log("purchase::onRestored", product);
            },
            onRestoreFailure: (product: IAPPurchaseProduct, errorMsg: string, errorCode: number) => {
                console.error("onRestoreFailure P: %s, EM: %s, EC: %s", JSON.stringify(product), errorMsg, errorCode);
            },
            onProductRequestSuccess: (products) => {
                this.retryCount = 0;
                //Returns you the data for all the iap products
                //You can get each item using following method
                if (!this.packMap.size()) {
                    console.log("onProductRequestSuccess: No packages found");
                    this.onPackageFetchFail();
                    return;
                }
                const updatedPacks: StorePackData[] = [];
                for (let i = 0; i < products.length; i++) {
                    const product = products[i];
                    this.printProduct(product);
                    const id = product.id;
                    if (id && product.price) {
                        let pack = this.packMap.getValue(id);
                        if (pack) {
                            pack.price = product.price;
                            pack.priceValue = product.priceValue;
                            updatedPacks.push(pack);
                        } else {
                            pack = {
                                packID: id,
                                price: product.price,
                                priceValue: product.priceValue,
                                inStore: false,
                                asset: "",
                                inStoreRaw: "",
                                itemType: "",
                                tag: "",
                                itemValue: 0,
                                itemName: ""
                            }
                            updatedPacks.push(pack);
                        }
                    } else {
                        console.log("onProductRequestSuccess: No product id");
                    }
                }
                this.updatePackMap(updatedPacks);
                this.onPackageFetchSuccess(products);
            },
            onProductRequestFailure: (msg) => {
                const params = { "kingdom": msg || "" };
                console.log(`${TrackingEvents.SdkboxPackageFetchFailed} : ${params}`);

                //When product refresh request fails.
                this.onPackageFetchFail();
                ++this.retryCount;
                const retryTime = Math.min(MAX_BACKOFF_TIME, this.retryCount * BACKOFF_TIME_STEP);
                setTimeout(() => {
                    this.startPackageFetch();
                }, retryTime);
                console.log("purchase::onProductRequestFailure", msg);
            },
            onPlayPassStatusUpdate: (active: boolean, token: string) => {
                console.log("play pass status update", active);
                this.playPassActive = active;
                if (active) {
                    this.noAdsPurchaseToken = token;
                }
                const event = new cc.Event.EventCustom(StoreEvent.PlayPassStatusUpdated, true);
                event.setUserData(this.playPassActive);
                this.getEventDispatcher().dispatchEvent(event);
                this.requestor.onPlayPassStatusUpdated(this.playPassActive);
            },
            onUnConsumedProductsUpdate: (products: IAPPurchaseProduct[]) => {
                if (this.isPurchaseFlowInProgress()) {
                    console.log("un consumed products update - purchase flow in progress");
                    return;
                }
                console.log("un consumed products update");
                if (products == null || products == undefined || products.length == 0) {
                    console.log("no pending un-consumed products");
                } else {
                    products.forEach(product => {
                        console.log(":: ", product.id);
                        this.purchaseSilentServerTransaction(product);
                    });
                }
            },
        });
    }
    private printProduct(product) {
        for (const key in product) {
            console.log("onProductRequestSuccess", key, product[key]);
        }
    }
    private purchaseSilentServerTransaction(product: IAPPurchaseProduct) {
        const signature = product.receiptCipheredPayload;
        const receipt = product.receipt;
        const payload: IPurchaseRequest = {
            productId: product.id,
            receipt: receipt,
            signature: signature,
            os: this.config.osName,
            userId: this.config.userId,
            transactionID: product.transactionID
        };
        this.logPurchaseEvent(product.id, this.getStageForSilent(PurchaseStages.ServerStart));
        this.requestor.sendPostRequest(this.config.purchaseApiEndpoint, JSON.stringify(payload), (success: boolean, response: IResponse) => {
            if (success && response) {
                console.log("store purchaseSilentServerTransaction done:", success, JSON.stringify(response));
                if (!response.error || response.error == PurchaseErrorCodes.DuplicateOrder) {
                    this.consumePurchase(product.id, product.purchaseToken).then(() => {
                        this.logPurchaseEvent(product.id, this.getStageForSilent(PurchaseStages.ConsumeSuccess));
                    }).catch((errorCode: BillingResponseCode) => {
                        this.logPurchaseError(product.id, errorCode.toString(), this.getStageForSilent(PurchaseStages.ConsumeFailed));
                    });
                    if (!response.error) {
                        this.productsGrantedSilently.push(response as PurchaseEventData);
                        this.logPurchaseEvent(product.id, this.getStageForSilent(PurchaseStages.ServerSuccess));
                        this.eventDispatcher.dispatchEvent(
                            new cc.Event.EventCustom(StoreEvent.SilentPurchaseSuccess, true));
                    } else {
                        this.logPurchaseError(product.id, response.error, this.getStageForSilent(PurchaseStages.Failed));
                    }
                } else {
                    this.logPurchaseError(product.id, response.error, this.getStageForSilent(PurchaseStages.Failed));
                }
            } else if (!success) {
                this.logPurchaseError(
                    product.id, PurchaseErrorCodes.ConnectionFailed, this.getStageForSilent(PurchaseStages.Failed));
            } else {
                this.logPurchaseError(product.id, "empty response", this.getStageForSilent(PurchaseStages.Failed));
            }
        });
    }
    private getStageForSilent(stage: PurchaseStages): string {
        return stage + SilentPurchaseStageSuffix;
    }
    private purchaseServerTransaction(product: IAPPurchaseProduct, purchaseStageSuffix = "") {
        this.currentPurchaseState = PurchaseFlowState.ServerPurchaseStart;
        this.failedServerPurchaseProduct = null;
        this.logPurchaseEvent(product.id, PurchaseStages.ServerStart + purchaseStageSuffix);
        const signature = product.receiptCipheredPayload;
        const receipt = product.receipt;
        console.log("Payments signature:", signature);
        console.log("Payments receipt:", receipt);
        const onSuccess = (response: IResponse) => {
            const event = new cc.Event.EventCustom(StoreEvent.PurchaseComplete, true);
            if (response) {
                const eventData = response as PurchaseEventData;

                if (this.config.isDebug) {
                    // DebugTextPopup.showPopup("Payments Response:\n" + JSON.stringify(response));
                    console.log("Payments Response:\n" + JSON.stringify(response));
                }

                eventData.productid = product.id;
                eventData.receipt = receipt;
                eventData.signature = signature;
                event.setUserData(eventData);
                if (response.error) {
                    this.currentPurchaseState = PurchaseFlowState.ServerPurchaseFailed;
                    console.error("Payments response.error:", response.error);
                    this.logPurchaseError(product.id, response.error.toString(), PurchaseStages.Failed + purchaseStageSuffix);
                    this.eventDispatcher.dispatchEvent(event);
                } else {
                    this.currentPurchaseState = PurchaseFlowState.ConsumeStart;
                    eventData.producePriceValue = product.priceValue;
                    eventData.currencyCode = product.currencyCode;
                    eventData.transactionID = product.transactionID;

                    console.log("Payments SUCCESS, response:", response);
                    this.logPurchaseEvent(product.id, PurchaseStages.ServerSuccess + purchaseStageSuffix);
                    this.requestor.logCustomEvent(TrackingEvents.ServerPurchaseSuccess, {
                        kingdom: product.id,
                        phylum: product.priceValue,
                        class: product.currencyCode,
                        family: product.transactionID,
                    });
                    this.iapLib.onServerSuccess(product.purchaseToken);
                    this.onPackPurchased(product);
                    this.consumeWaitProduct = product;
                    this.consumeWaitEvent = event;

                    this.consumePurchase(product.id, product.purchaseToken).then(() => {
                        this.onPurchaseFlowConsumeSuccess();
                    }).catch((errorCode: BillingResponseCode) => {
                        console.log("store consume fail error:", errorCode);
                        this.onPurchaseFlowConsumeFailed(errorCode);
                    });
                }
            } else {
                this.currentPurchaseState = PurchaseFlowState.ServerPurchaseFailed;
                console.error("Payments ERROR, Empty response!:", response);
                this.logPurchaseError(product.id, "empty response", PurchaseStages.Failed + purchaseStageSuffix);
                const purchaseResponse: PurchaseEventData = {
                    error: "empty response",
                    productid: product.id,
                    data: null,
                    receipt: receipt,
                    signature: signature
                };
                event.setUserData(purchaseResponse);
                this.eventDispatcher.dispatchEvent(event);
            }
        }
        const onFailure = (error: string) => {
            this.currentPurchaseState = PurchaseFlowState.ServerPurchaseFailed;
            const event = new cc.Event.EventCustom(StoreEvent.PurchaseComplete, true);
            const purchaseResponse: PurchaseEventData = {
                error: PurchaseErrorCodes.ConnectionFailed,
                productid: product.id,
                receipt: receipt,
                signature: signature,
                data: null
            };
            console.error("Payments ERROR, Connection Failed!: %s", JSON.stringify(error));
            this.logPurchaseError(product.id, PurchaseErrorCodes.ConnectionFailed, PurchaseStages.Failed + purchaseStageSuffix);
            event.setUserData(purchaseResponse);
            this.failedServerPurchaseProduct = product;
            this.eventDispatcher.dispatchEvent(event);
        }
        const payload: IPurchaseRequest = {
            productId: product.id,
            receipt: receipt,
            signature: signature,
            os: this.config.osName,
            userId: this.config.userId,
            transactionID: product.transactionID
        };

        if (this.config.isDebug) {
            // DebugTextPopup.showPopup("Payments Request:\n" + JSON.stringify(payload));
            console.log("Payments Request:\n" + JSON.stringify(payload));
        }
        this.requestor.sendPostRequest(this.config.purchaseApiEndpoint, JSON.stringify(payload),
            (success: boolean, response: IResponse) => {
                if (success) {
                    onSuccess(response);
                } else {
                    onFailure(response?.error);
                }
            });
    }

    private onPurchaseFlowConsumeSuccess(purchaseStageSuffix = "") {
        this.currentPurchaseState = PurchaseFlowState.Idle;
        const eventData: PurchaseEventData = this.consumeWaitEvent.getUserData();
        eventData.error = null;
        eventData.consumeError = null;
        this.eventDispatcher.dispatchEvent(this.consumeWaitEvent);
        this.consumeWaitEvent = null;
        this.consumeWaitProduct = null;
        this.logPurchaseEvent(eventData.productid, PurchaseStages.ConsumeSuccess + purchaseStageSuffix);
    }

    private onPurchaseFlowConsumeFailed(errorCode: BillingResponseCode, purchaseStageSuffix = "") {
        this.currentPurchaseState = PurchaseFlowState.ConsumeFailed;
        const eventData: PurchaseEventData = this.consumeWaitEvent.getUserData();
        eventData.error = PurchaseErrorCodes.ConsumeFailed;
        eventData.consumeError = errorCode;
        this.eventDispatcher.dispatchEvent(this.consumeWaitEvent);
        this.logPurchaseError(eventData.productid, errorCode.toString(), PurchaseStages.ConsumeFailed + purchaseStageSuffix);
    }

    protected onPackPurchased(product: IAPPurchaseProduct) {
        // NOTE: Project can override this to add code for this step
        console.log("Product %s", JSON.stringify(product));
    }

    //#region TESTING

    public testPurchaseServerTransaction(pack: string) {
        const event = new cc.Event.EventCustom(StoreEvent.PurchaseComplete, true);
        const eventData: PurchaseEventData = {
            productid: pack,
            error: null,
            data: {
                consumables: {
                    "hints": 5,
                    "retries": 2
                },
            }
        }
        eventData.receipt = "";
        eventData.signature = "";

        event.setUserData(eventData);
        this.eventDispatcher.dispatchEvent(event);
    }

    //#endregion

    private onInitialized() {
        const event = new cc.Event.EventCustom(StoreEvent.Initialized, true);
        this.eventDispatcher.dispatchEvent(event);
    }
    private onPurchaseFailedOnClient(product: IAPProductBase, error: string| {message: string}) {
        this.currentPurchaseState = PurchaseFlowState.Idle;
        this.logPurchaseEvent(product.id, PurchaseStages.Failed, error);
        const event = new cc.Event.EventCustom(StoreEvent.PurchaseComplete, true);
        const purchaseResponse: PurchaseEventData = {
            error: PurchaseErrorCodes.ClientFailed,
            productid: product.id,
            extraError: (error as {message: string}).message,
            data: null
        };
        event.setUserData(purchaseResponse);
        this.eventDispatcher.dispatchEvent(event);
    }
    private onPurchaseCancelledOnClient(product) {
        this.logPurchaseEvent(product.id, PurchaseStages.Cancelled);
        const event = new cc.Event.EventCustom(StoreEvent.PurchaseComplete, true);
        const purchaseResponse: PurchaseEventData = {
            error: PurchaseErrorCodes.Cancelled,
            productid: product.id
        };
        event.setUserData(purchaseResponse);
        this.eventDispatcher.dispatchEvent(event);
    }
    private initPackData() {
        this.packData.sort((a: StorePackData, b: StorePackData) => {
            if (a.priceValue < b.priceValue) {
                return -1;
            } else if (a.priceValue > b.priceValue) {
                return 1;
            }
            return 0;
        });
        this.updatePackMap(this.packData);
    }
    private updatePackMap(packs: StorePackData[]) {
        for (const pack of packs) {
            this.packMap.setValue(pack.packID, pack);
        }
    }
    private logPurchaseEvent(packID: string, stage: string, error?: string | {message: string}) {
        if (error) {
            const params = {
                "kingdom": packID,
                "phylum": stage,
                "class": JSON.stringify(error)
            };
            this.requestor.logCustomEvent(TrackingEvents.PurchaseVirtualCurrency, params);
        }
        else {
            const params = {
                "kingdom": packID,
                "phylum": stage
            };
            this.requestor.logCustomEvent(TrackingEvents.PurchaseVirtualCurrency, params);
        }
    }
    private logPurchaseError(packID: string, error: string, purchaseStage: string) {
        const params = {
            "kingdom": packID,
            "phylum": purchaseStage,
            "class": error
        };
        this.requestor.logCustomEvent(TrackingEvents.PurchaseVirtualCurrency, params)

    }
    private logInitError(err) {
        console.error("iap_init_failed %s", JSON.stringify(err));
        this.requestor.logCustomEvent("iap_init_failed");
    }

    protected onPackageFetchSuccess(packs: IAPProduct[]) {
        this.currentSdkState = SdkState.PackagesFetched;
        this.eventDispatcher.emit(StoreEvent.PackageFetchSuccess);
    }
    private onPackageFetchFail() {
        this.currentSdkState = SdkState.PackagesFetchFailed;
        this.eventDispatcher.emit(StoreEvent.PackageFetchFail);
    }
    private startSetup(): void {
        this.currentSdkState = SdkState.SdkSettingUp;
    }
    startPackageFetch() {
        this.currentSdkState = SdkState.PackagesFetching;
        this.initPackData();
        this.iapLib.refresh();
    }
}
