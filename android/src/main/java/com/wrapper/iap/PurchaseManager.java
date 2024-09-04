package com.wrapper.iap;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClient.BillingResponseCode;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.ConsumeResponseListener;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchaseHistoryRecord;
import com.android.billingclient.api.PurchaseHistoryResponseListener;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchaseHistoryParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import com.google.common.collect.ImmutableList;

public class PurchaseManager {
    private static final String TAG = "PurchaseManager";

    private static PurchaseManager mPurchaseManager;
    private Activity mActivity;
    private PurchaseEventListener mPurchaseEventListener;
    private BillingClient mBillingClient;
    private static String mPlayPassNoAdsPackId;

    // productId => type(consumable or non_consumable)
    private HashMap<String, String> mProductTypeMap = new HashMap<>();
    // productId => ProductDetails
    private HashMap<String, ProductDetails> mProductDetailsMap = new HashMap<>();

    /**
     * combined result queryPurchasesAsync() and queryPurchaseHistoryAsync()
     */
    private List<JSONObject> mPurchaseHistoryList = new ArrayList<>();
    private ProductDetails mCurrentRequestPurchaseSkuDetails;
    private String mLicenseKey;
    private boolean mBillingInitialized = false;

    private PurchasesUpdatedListener mPurchasesUpdatedListener = new PurchasesUpdatedListener() {
        @Override
        public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
            if (billingResult.getResponseCode() == BillingResponseCode.OK && purchases != null) {
                for (Purchase purchase : purchases) {
                    handlePurchase(purchase);
                }
            } else if (billingResult.getResponseCode() == BillingResponseCode.USER_CANCELED) {
                Product product = getProductFromSkuDetails(mCurrentRequestPurchaseSkuDetails);
                mPurchaseEventListener.onPurchaseCanceled(product);
            } else {
                Product product = getProductFromSkuDetails(mCurrentRequestPurchaseSkuDetails);
                mPurchaseEventListener.onPurchaseFailure(product, billingResult.getResponseCode(), billingResponseCodeToString(billingResult.getResponseCode()));
            }
        }
    };

    public static void onStop() {
        if (mPurchaseManager == null || !mPurchaseManager.isInitialized()) {
            return;
        }

        if (mPurchaseManager.mBillingClient == null) {
            return;
        }

        mPurchaseManager.mBillingClient.endConnection();
    }

    public static boolean onBackPressed() {
        return false;
    }

    public static void onStart() {
    }

    private Product getProductFromSkuDetails(@NonNull ProductDetails productDetails) {
        String type = getProductType(productDetails.getProductId());
        return Product.createFromProductDetails(productDetails, type);
    }

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            return;
        }

        // Returning in-case purchase update after app relaunch
        // and allowing these purchases to go through the silent purchase flow
        if (mCurrentRequestPurchaseSkuDetails == null) {
           return;
        }

        Product product = getProductFromSkuDetails(mCurrentRequestPurchaseSkuDetails);
        product.transactionID = purchase.getOrderId();
        product.receipt = purchase.getOriginalJson();
        product.receiptCipheredPayload = purchase.getSignature();
        product.purchaseToken = purchase.getPurchaseToken();
        mPurchaseEventListener.onPurchaseSuccess(product);
        if (!product.type.equals("consumable") && !purchase.isAcknowledged()) {
            acknowledgePurchase(purchase.getPurchaseToken());
        }
    }

    private void queryProductDetailsAsync(String productTYpe, ProductDetailsResponseListener listener) {
        QueryProductDetailsParams queryProductDetailsParams = QueryProductDetailsParams.newBuilder()
                .setProductList(getProductList(productTYpe))
                .build();
        mBillingClient.queryProductDetailsAsync(queryProductDetailsParams, listener);
    }

    private void consumeAsync(Product product) {
        String purchaseToken = product.purchaseToken;
        ConsumeParams params = ConsumeParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();

        mBillingClient.consumeAsync(params, new ConsumeResponseListener() {
            @Override
            public void onConsumeResponse(@NonNull BillingResult billingResult, @NonNull String purchaseToken) {
                if(billingResult.getResponseCode() == BillingResponseCode.OK) {
                    Log.d(TAG, "product consumed successfully");
                    mPurchaseEventListener.onConsumeSuccess(product);
                }else {
                    Log.d(TAG, "product consumed failed: " + billingResult.getDebugMessage());
                    mPurchaseEventListener.onConsumeFailure(product, billingResult.getResponseCode(), billingResult.getDebugMessage());
                }
            }
        });
    }

    private void acknowledgePurchase(String purchaseToken) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchaseToken).build();
        mBillingClient.acknowledgePurchase(params, new AcknowledgePurchaseResponseListener() {
            @Override
            public void onAcknowledgePurchaseResponse(@NonNull BillingResult billingResult) {
                Log.d(TAG, "Purchase acknowledge response: " + billingResult.getResponseCode());
            }
        });
    }
    public static void init(Activity activity) {
        if (mPurchaseManager == null)
        {
            mPurchaseManager = new PurchaseManager();
        }
        mPurchaseManager.mActivity = activity;
    }
    public static PurchaseManager getInstance()
    {
        return mPurchaseManager;
    }

    public static void onResume() {
        if (getInstance().isInitialized() && !getInstance().isBillingClientValid()) {
           getInstance().createNewBillingClient();
        }
        if (mPlayPassNoAdsPackId != null && mPlayPassNoAdsPackId.length() > 0) {
            getInstance().checkPlayPassStatus();
        }
        if (getInstance().mProductDetailsMap.size() > 0) {
            getInstance().queryUnconsumedPurchases();
        }
    }

    public static void onPause() {}

    public Activity getActivity() {
        return mActivity;
    }

    public void setPurchaseEventListener(PurchaseEventListener listener) {
        mPurchaseEventListener = listener;
    }

    public void removePurchaseEventListener() {
        mPurchaseEventListener = null;
    }

    public void init(String sdkboxConfigJsonString) {
        try {
            JSONObject configJson = new JSONObject(sdkboxConfigJsonString);
            JSONObject iapJson = configJson.getJSONObject("android").getJSONObject("iap");

            mLicenseKey = iapJson.getString("key");
            JSONObject items = iapJson.getJSONObject("items");

            mProductTypeMap.clear();
            for (Iterator<String> it = items.keys(); it.hasNext(); ) {
                String name = it.next();
                JSONObject item = items.getJSONObject(name);

                String productId = item.getString("id");
                String type = item.getString("type");
                mProductTypeMap.put(productId, type);
            }
        }catch(JSONException e) {
            if(mPurchaseEventListener != null) {
                mPurchaseEventListener.onInitialized(false);
                return;
            }
        }

        createNewBillingClient();
    }

    public boolean isInitialized() { return mBillingClient != null && mBillingInitialized; }

    public boolean isReady() { return isInitialized() && mBillingClient.isReady(); }

    public void queryProductListAsync() {
        if(!isReady() || mPurchaseEventListener == null) {
            if(mPurchaseEventListener != null) {
                mPurchaseEventListener.onQueryProductListFailure("BillingClient is not initialized");
            }
            return;
        }
        queryProductDetailsAsync(BillingClient.ProductType.INAPP, new ProductDetailsResponseListener() {
            @Override
            public void onProductDetailsResponse(@NonNull BillingResult billingResult, @Nullable List<ProductDetails> productDetailsList) {
                mProductDetailsMap.clear();
                if(productDetailsList == null) {
                    mPurchaseEventListener.onQueryProductListFailure("productDetailsList is empty");
                    return;
                }

                if(billingResult.getResponseCode() == BillingResponseCode.OK) {
                    for (ProductDetails productDetails : productDetailsList) {
                        mProductDetailsMap.put(productDetails.getProductId(), productDetails);
                    }

                    queryProductDetailsAsync(BillingClient.ProductType.SUBS, new ProductDetailsResponseListener() {
                        @Override
                        public void onProductDetailsResponse(@NonNull BillingResult billingResult, @NonNull List<ProductDetails> subDetailsList) {
                            if (subDetailsList != null && billingResult.getResponseCode() == BillingResponseCode.OK) {
                                for (ProductDetails subDetails: subDetailsList) {
                                    mProductDetailsMap.put(subDetails.getProductId(), subDetails);
                                }
                            }
                            try {
                                JSONArray products = new JSONArray();
                                for(String productId : mProductDetailsMap.keySet()) {
                                    String type = getProductType(productId);
                                    Product product = Product.createFromProductDetails(mProductDetailsMap.get(productId), type);
                                    products.put(product.toJson());
                                }
                                mPurchaseEventListener.onQueryProductListSuccess(products);
                                //Query unconsumed products
                                queryUnconsumedPurchases();
                            }catch(JSONException e) {
                                mPurchaseEventListener.onQueryProductListFailure(e.getMessage());
                            }
                        }
                    });
                }else {
                    String message = String.format(Locale.ENGLISH,
                            "queryProductListAsync failed: responseCode=%d(%s), debugMessage=%s",
                            billingResult.getResponseCode(),
                            billingResponseCodeToString(billingResult.getResponseCode()),
                            billingResult.getDebugMessage());
                    Log.e(TAG, message);
                    mPurchaseEventListener.onQueryProductListFailure(message);
                }
            }
        });
    }

    private @NonNull List<QueryProductDetailsParams.Product> getProductList(String productType) {
        List<String> productIdList = new ArrayList<>(mProductTypeMap.keySet());
        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        for(String productId : productIdList) {
            productList.add(
                    QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(productId)
                            .setProductType(productType)
                            .build()
            );
        }
        return productList;
    }

    private void queryUnconsumedPurchases() {
        Log.d(TAG, "queryUnconsumedPurchases");
        if(mPurchaseEventListener == null) {
            return;
        }
        if(!isReady()) {
            return;
        }
        QueryPurchasesParams queryPurchasesParams = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        mBillingClient.queryPurchasesAsync(queryPurchasesParams, new PurchasesResponseListener() {
            @Override
            public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
                if(billingResult.getResponseCode() == BillingResponseCode.OK) {
                    JSONArray productList = new JSONArray();
                    try {
                        Log.w(TAG, "un consume purchaseCount:" + purchases.size());
                        for(Purchase purchase : purchases) {
                            String productId = purchase.getProducts().get(0);
                            ProductDetails productDetails = getSkuDetailsByProductId(productId);
                            if(productDetails == null) {
                                continue;
                            }
                            Product product = getProductFromSkuDetails(productDetails);
                            if(product.type.equals("consumable")) {
                                product.transactionID = purchase.getOrderId();
                                product.receipt = purchase.getOriginalJson();
                                product.receiptCipheredPayload = purchase.getSignature();
                                product.purchaseToken = purchase.getPurchaseToken();

                                productList.put(product.toJson());
                            }
                        }
                        if(mPurchaseEventListener != null) {
                            mPurchaseEventListener.onUnConsumedProductsUpdate(productList);
                        }
                    }catch(JSONException e) {
                        mPurchaseEventListener.onUnConsumedProductsUpdate(productList);
                        Log.w(TAG, "query unconsumed product failed");
                    }
                }
            }
        });
    }

    /**
     * combined result queryPurchasesAsync() and queryPurchaseHistoryAsync()
     */
    public void getPurchaseHistory() {
        mPurchaseHistoryList.clear();

        if(mPurchaseEventListener == null) {
            return;
        }

        if(!isReady()) {
            // Returning a empty array
            mPurchaseEventListener.onPurchaseHistoryRequestSuccess(new JSONArray());
            return;
        }

        QueryPurchasesParams queryPurchasesParams = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();

        mBillingClient.queryPurchasesAsync(queryPurchasesParams, new PurchasesResponseListener() {
            @Override
            public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
                if(billingResult.getResponseCode() == BillingResponseCode.OK) {
                    for(Purchase purchase : purchases) {
                        try {
                            JSONObject record = new JSONObject();
                            record.put("productId", purchase.getProducts().get(0));
                            record.put("orderId", purchase.getOrderId());
                            record.put("purchaseTime", purchase.getPurchaseTime());
                            record.put("purchaseToken", purchase.getPurchaseToken());
                            record.put("originalJson", purchase.getOriginalJson());
                            record.put("signature", purchase.getSignature());
                            record.put("quantity", purchase.getQuantity());

                            String purchaseState = "UNKNOWN";
                            if(purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                purchaseState = "PURCHASED";
                            }else if(purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                                purchaseState = "PENDING";
                            }else if(purchase.getPurchaseState() == Purchase.PurchaseState.UNSPECIFIED_STATE) {
                                purchaseState = "UNSPECIFIED_STATE";
                            }
                            record.put("purchaseState", purchaseState);

                            mPurchaseHistoryList.add(record);
                        }catch(Exception e) {
                        }
                    }
                }
                QueryPurchaseHistoryParams purchaseHistoryParams = QueryPurchaseHistoryParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
                mBillingClient.queryPurchaseHistoryAsync(purchaseHistoryParams, new PurchaseHistoryResponseListener() {
                    @Override
                    public void onPurchaseHistoryResponse(@NonNull BillingResult billingResult, @Nullable List<PurchaseHistoryRecord> purchaseHistoryRecords) {
                        if(billingResult.getResponseCode() == BillingResponseCode.OK && purchaseHistoryRecords != null) {
                            for(PurchaseHistoryRecord purchaseHistoryRecord : purchaseHistoryRecords) {
                                try {
                                    JSONObject record = new JSONObject();
                                    record.put("productId", purchaseHistoryRecord.getProducts().get(0));
                                    record.put("purchaseTime", purchaseHistoryRecord.getPurchaseTime());
                                    record.put("purchaseToken", purchaseHistoryRecord.getPurchaseToken());
                                    record.put("originalJson", purchaseHistoryRecord.getOriginalJson());
                                    record.put("signature", purchaseHistoryRecord.getSignature());
                                    record.put("quantity", purchaseHistoryRecord.getQuantity());

                                    mPurchaseHistoryList.add(record);
                                }catch(Exception e) {}
                            }
                        }

                        if(mPurchaseEventListener != null) {
                            JSONArray historyList = new JSONArray(mPurchaseHistoryList);
                            mPurchaseEventListener.onPurchaseHistoryRequestSuccess(historyList);
                        }
                    }
                });
            }
        });
    }

    public void queryPurchases() {
        QueryPurchasesParams queryPurchasesParams = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        mBillingClient.queryPurchasesAsync(queryPurchasesParams, new PurchasesResponseListener() {
            @Override
            public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
                if(billingResult.getResponseCode() == BillingResponseCode.OK) {
                  try {
                      JSONArray productList = new JSONArray();
                      for(Purchase purchase : purchases) {
                          String productId = purchase.getProducts().get(0);
                          ProductDetails productDetails = getSkuDetailsByProductId(productId);
                          if(productDetails == null) {
                              continue;
                          }

                          Product product = getProductFromSkuDetails(productDetails);
                          product.transactionID = purchase.getOrderId();
                          product.receipt = purchase.getOriginalJson();
                          product.receiptCipheredPayload = purchase.getSignature();
                          product.purchaseToken = purchase.getPurchaseToken();

                          productList.put(product.toJson());
                      }

                      mPurchaseEventListener.onQueryPurchasesSuccess(productList);
                  }catch(JSONException e) {
                      mPurchaseEventListener.onQueryPurchasesFailure(BillingResponseCode.ERROR, e.getMessage());
                  }
                }else {
                    mPurchaseEventListener.onQueryPurchasesFailure(billingResult.getResponseCode(), billingResult.getDebugMessage());
                }
            }
        });
    }

    public void purchase(String productId) {
        mCurrentRequestPurchaseSkuDetails = null;
        if(mPurchaseEventListener == null) {
            return;
        }
        if(!isReady()) {
            Product emptyItem = new Product();
            mPurchaseEventListener.onPurchaseFailure(emptyItem, BillingResponseCode.BILLING_UNAVAILABLE, "Billing Client not ready!");
            return;
        }
        ProductDetails productDetails = getSkuDetailsByProductId(productId);
        if(productDetails == null) {
            Product emptyItem = new Product();
            mPurchaseEventListener.onPurchaseFailure(emptyItem, BillingResponseCode.ITEM_UNAVAILABLE, "Product details not found!");
            return;
        }

        mCurrentRequestPurchaseSkuDetails = productDetails;
        String offerToken = "";
        if ((productDetails.getProductType() == BillingClient.ProductType.SUBS)) {
            productDetails.getSubscriptionOfferDetails().get(0).getOfferToken();
        }
        ImmutableList<BillingFlowParams.ProductDetailsParams> productDetailsParamsList =
                ImmutableList.of(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(productDetails)
                                .setOfferToken(offerToken)
                                .build()
                );

        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(productDetailsParamsList)
                .build();
        mBillingClient.launchBillingFlow(getActivity(), params);
    }

    public void consume(String productId, String purchaseToken) {
        ProductDetails productDetails = getSkuDetailsByProductId(productId);
        Product product = getProductFromSkuDetails(productDetails);
        product.purchaseToken = purchaseToken;
        consumeAsync(product);
    }

    private void initPlayPass(String noAdsPackId) {
        mPlayPassNoAdsPackId = noAdsPackId;
        checkPlayPassStatus();
    }

    private void checkPlayPassStatus() {
        if(mPurchaseEventListener == null) {
            return;
        }

        if(!isReady()) {
            return;
        }

        QueryPurchasesParams queryPurchasesParams = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();

        mBillingClient.queryPurchasesAsync(queryPurchasesParams, new PurchasesResponseListener() {
            @Override
            public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
                if (billingResult.getResponseCode() == BillingResponseCode.OK) {
                    boolean playPassActive = false;
                    String noAdsPackToken = "";
                    for (Purchase purchase : purchases) {
                        try {
                            if (mPlayPassNoAdsPackId.equals(purchase.getProducts().get(0))) {
                                playPassActive = true;
                                noAdsPackToken = purchase.getPurchaseToken();
                                break;
                            }
                        }
                        catch (Exception e) {
                            Log.e(TAG, "Error::Query purchased items: " + e.toString());
                        }
                    }
                    mPurchaseEventListener.onPlayPassStatusUpdate(playPassActive, noAdsPackToken);
                }
            }
        });
    }

    private @Nullable ProductDetails getSkuDetailsByProductId(String productId) {
        return mProductDetailsMap.get(productId);
    }

    private @NonNull String getProductType(String productId) {
        return Objects.requireNonNull(mProductTypeMap.get(productId));
    }

    private static String billingResponseCodeToString(int responseCode) {
        switch(responseCode) {
            case BillingResponseCode.OK:
                return "OK";
            case BillingResponseCode.USER_CANCELED:
                return "USER_CANCELED";
            case BillingResponseCode.SERVICE_UNAVAILABLE:
                return "SERVICE_UNAVAILABLE";
            case BillingResponseCode.SERVICE_TIMEOUT:
                return "SERVICE_TIMEOUT";
            case BillingResponseCode.SERVICE_DISCONNECTED:
                return "SERVICE_DISCONNECTED";
            case BillingResponseCode.ITEM_UNAVAILABLE:
                return "ITEM_UNAVAILABLE";
            case BillingResponseCode.ITEM_NOT_OWNED:
                return "ITEM_NOT_OWNED";
            case BillingResponseCode.ITEM_ALREADY_OWNED:
                return "ITEM_ALREADY_OWNED";
            case BillingResponseCode.FEATURE_NOT_SUPPORTED:
                return "FEATURE_NOT_SUPPORTED";
            case BillingResponseCode.ERROR:
                return "ERROR";
            case BillingResponseCode.DEVELOPER_ERROR:
                return "DEVELOPER_ERROR";
            case BillingResponseCode.BILLING_UNAVAILABLE:
                return "BILLING_UNAVAILABLE";
            default:
                return "UNKNOWN";
        }
    }

    private boolean isBillingClientValid() {
        return mBillingClient != null &&
              (mBillingClient.getConnectionState() == BillingClient.ConnectionState.CONNECTED ||
               mBillingClient.getConnectionState() == BillingClient.ConnectionState.CONNECTING);
    }

    private void createNewBillingClient() {
        if (isBillingClientValid()) {
            return;
        }

        mBillingClient = BillingClient.newBuilder(getActivity())
                .setListener(mPurchasesUpdatedListener)
                .enablePendingPurchases()
                .build();

        mBillingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                boolean isSuccess = false;

                if(billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "BillingClient initialize success");
                    mBillingInitialized = true;
                    isSuccess = true;
                } else {
                    String message = String.format(Locale.ENGLISH,
                            "BillingClient initialize failed: responseCode=%d(%s), debugMessage=%s",
                            billingResult.getResponseCode(),
                            billingResponseCodeToString(billingResult.getResponseCode()),
                            billingResult.getDebugMessage());
                    Log.e(TAG, message);
                    mBillingInitialized = false;
                }

                if(mPurchaseEventListener != null) {
                    mPurchaseEventListener.onInitialized(isSuccess);
                }
                if (mPlayPassNoAdsPackId != null && mPlayPassNoAdsPackId.length() > 0) {
                    checkPlayPassStatus();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                if(mBillingClient != null) {
                    mBillingInitialized = false;
                    mBillingClient = null;
                }
            }
        });
    }
}
