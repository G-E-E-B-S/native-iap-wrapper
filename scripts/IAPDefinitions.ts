export interface IAPProductBase {
    id : string
}

export interface IAPProduct extends IAPProductBase {
    title : string,
    description : string,
    price : string,
    priceValue : number,
    currencyCode : string,
}

export interface IAPPurchaseProduct extends IAPProduct {
    transactionID : string,
    receipt? : string,
    receiptCipheredPayload : string,
    purchaseToken: string,  
}
export interface IPurchaseRequest {
    userId: string,
    productId: string,
    os: string,
    receipt: string,
    signature: string,
    transactionID : string,
    restore?: boolean,
}
export interface StorePackData {
    packID: string;
    itemType: string;
    inStoreRaw: string;
    inStore: boolean;
    itemValue: unknown;
    price: string;
    priceValue: number;
    itemName: string;
    asset: string;
    tag: string;
    itemImage?: string;
}
export interface IResponse {
    error?: string,
    data?: unknown,
    rewardCoins?: number,
    finalCoins?: number
}

export interface PurchaseEventData extends IResponse {
    productid: string,
    producePriceValue?: number,
    currencyCode?: string,
    transactionID?: string,
    receipt?: string,
    signature?: string,
    extraError?: string
    consumeError?: BillingResponseCode;
}
export enum StoreEvent {
    Initialized = "initialized",
    PurchaseStart = "purchase_start",
    PurchaseComplete = "purchase_complete",
    PackageFetchSuccess = "package_fetch_success",
    PackageFetchFail = "package_fetch_fail",
    InGamePurchase = "in_game_purchase",
    PlayPassStatusUpdated = "play_pass_status_updated",
    SilentPurchaseSuccess = "silent_purchase_success"
}

export enum  BillingResponseCode {
    SERVICE_TIMEOUT = -3,
    FEATURE_NOT_SUPPORTED = -2,
    SERVICE_DISCONNECTED = -1,
    OK = 0,
    USER_CANCELED = 1,
    SERVICE_UNAVAILABLE = 2,
    BILLING_UNAVAILABLE = 3,
    ITEM_UNAVAILABLE = 4,
    DEVELOPER_ERROR = 5,
    ERROR = 6,
    ITEM_ALREADY_OWNED = 7,
    ITEM_NOT_OWNED = 8
}
