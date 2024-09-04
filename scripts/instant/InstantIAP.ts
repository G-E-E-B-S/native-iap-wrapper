import { IAPProduct, IAPPurchaseProduct } from "../IAPDefinitions";
import { IAPListener, IPurchase, ISdkboxIAP } from "../ISdkboxIAP";


export class IAP implements ISdkboxIAP {
    queryUnconsumedPurchases(): void {
        FBInstant.payments.getPurchasesAsync().then((purchases) => {
            if (purchases.length > 0) {
                console.log("store queryUnconsumedPurchases : ", purchases.length);
                let unconsumedPacks: Array<IAPPurchaseProduct> = [];
                purchases.forEach((pack) => {
                    let product = this.productsMap[pack.productID];
                    if (product) {
                        unconsumedPacks.push({
                            title: product.title,
                            description: product.description,
                            id: product.productID,
                            price: product.price,
                            // @ts-ignore
                            priceValue: product.priceAmount || product.price,
                            currencyCode: product.priceCurrencyCode,
                            transactionID : pack.paymentID,
                            receiptCipheredPayload : pack.signedRequest,
                            purchaseToken: pack.purchaseToken,
                        })
                    }
                });
                this.listener.onUnConsumedProductsUpdate(unconsumedPacks);
            }
        });
    }
    onConsumed(product: IAPProduct): void {
        console.log("onConsumed %s", JSON.stringify(product));
    }
    onConsumeFailure(product: IAPProduct, errorMsg: string, errorCode: number): void {
        console.log("onConsumeFailure P: %s, err: %s, errCode: %s", JSON.stringify(product), errorMsg, errorCode);
    }
    getProducts(): Promise<IPurchase[]> {
        return FBInstant.payments.getPurchasesAsync().then((purchaseData) => {
            const purchases: IPurchase[] = [];
            purchaseData.forEach(purchase => {
                purchases.push({
                    token: purchase.purchaseToken,
                    id: purchase.productID,
                });
            });
            return purchases;
        });
    }
    isEnabled() : boolean {
        return this.enabled;
    }

    setListener(listener_ : IAPListener) {
        this.listener = listener_;
    }

    init() {
        this.productsMap = {};
        if (this.isApiSupported()) {
            this.enabled = true;
            FBInstant.payments.onReady(() => {
                this.listener?.onInitialized(true);
            });
        } else {
            this.listener?.onInitialized(false);
        }
    }

    initPlayPass(noAdsPackId: string): void {
        // NOTE: No op. Playpass is for google play only
        console.log("initPlayPass %s", noAdsPackId);
    }

    refresh() {
        FBInstant.payments.getCatalogAsync().then((catalog : FBInstant.Product[]) => {
            const products = new Array<IAPProduct>();
            catalog.forEach((product : FBInstant.Product) => {
                this.productsMap[product.productID] =  product;
                products.push({
                    title: product.title,
                    description: product.description,
                    id: product.productID,
                    price: product.price,
                    // @ts-ignore
                    priceValue: product.priceAmount || product.price,
                    currencyCode: product.priceCurrencyCode,
                })
            })
            this.listener.onProductRequestSuccess(products);
        }).catch((err) => {
            this.listener.onProductRequestFailure(err);
        });
    }

    restore() {
        // Do nothing
    }

    purchase(packID : string) {
        const product = this.productsMap[packID];
        if (!product) {
            this.listener.onFailure({id: packID}, "Pack not found", -1);
        }
        FBInstant.payments.purchaseAsync({
            productID: packID,
          }).then((purchase : FBInstant.Purchase) => {
            console.log(purchase);
            this.listener.onSuccess({
                id: purchase.productID,
                transactionID: purchase.paymentID,
                receiptCipheredPayload: purchase.signedRequest,
                title: product.title,
                description: product.description,
                price: product.price,
                // @ts-ignore
                priceValue: product.priceAmount || product.price,
                currencyCode: product.priceCurrencyCode,
                purchaseToken: purchase.purchaseToken,
            })
          }).catch((err) => {
              this.listener.onFailure({id: packID}, err, -1);
          });
    }

    onServerSuccess(token) {
        // no-op
    }
    consumePurchase(productId: string, purchaseToken: string): Promise<boolean> {
        return FBInstant.payments.consumePurchaseAsync(purchaseToken).then(function () {
            return true;
        });
    }
    private isApiSupported(): boolean {
        return FBInstant.getSupportedAPIs().indexOf("payments.purchaseAsync") != -1;
     }

    private productsMap : {[index :string] : FBInstant.Product};
    private enabled = false;
    private listener : IAPListener;
}
