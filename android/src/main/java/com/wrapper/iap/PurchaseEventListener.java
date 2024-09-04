package com.wrapper.iap;

import androidx.annotation.NonNull;

import org.json.JSONArray;
import org.json.JSONException;

public class PurchaseEventListener {

    /**
     * C++ Listener pointer address
     */
    private long mDelegate;

    private native void onInitialized(long delegate, boolean isSuccess);
    private native void onProductRequestSuccess(long delegate, String productListJsonString);
    private native void onProductRequestFailure(long delegate, String message);
    private native void onPurchaseHistoryRequestSuccess(long delegate, String purchaseListJsonString);
    private native void onPurchaseSuccess(long delegate, String productJsonString);
    private native void onPurchaseFailure(long delegate, String productJsonString, int responseCode, String message);
    private native void onPurchaseCanceled(long delegate, String productJsonString);
    private native void onConsumeSuccess(long delegate, String productJsonString);
    private native void onConsumeFailure(long delegate, String productJsonString, int responseCode, String message);
    private native void onRestored(long delegate, String productListJsonString);
    private native void onRestoreFailure(long delegate, int responseCode, String message);
    private native void onQueryPurchasesSuccess(long delegate, String productListJsonString);
    private native void onQueryPurchasesFailure(long delegate, int responseCode, String message);
    private native void onPlayPassStatusUpdate(long delegate, boolean active, String productToken);
    private native void onUnConsumedProductsUpdate(long delegate, String productListJsonString);

    /**
     * set C++ PurchaseEventListener pointer address
     * @param delegate
     */
    public PurchaseEventListener(long delegate) {
        mDelegate = delegate;
    }

    public void onInitialized(boolean isSuccess) {
        onInitialized(mDelegate, isSuccess);
    }

    void onQueryProductListSuccess(@NonNull JSONArray products) {
        onProductRequestSuccess(mDelegate, products.toString());
    }

    void onQueryProductListFailure(String message) {
        onProductRequestFailure(mDelegate, message);
    }

    void onPurchaseHistoryRequestSuccess(@NonNull JSONArray historyList) {
        onPurchaseHistoryRequestSuccess(mDelegate, historyList.toString());
    }

    void onPurchaseSuccess(Product product) {
        try {
            onPurchaseSuccess(mDelegate, product.toJson().toString());
        }catch(JSONException ignored) {
        }
    }

    void onPurchaseFailure(Product product, int responseCode, String message) {
        try {
            onPurchaseFailure(mDelegate, product.toJson().toString(), responseCode, message);
        }catch(JSONException ignored) {
        }
    }

    void onPurchaseCanceled(Product product) {
        try {
            onPurchaseCanceled(mDelegate, product.toJson().toString());
        }catch(JSONException ignored) {
        }
    }

    void onConsumeSuccess(@NonNull Product product) {
        try {
            onConsumeSuccess(mDelegate, product.toJson().toString());
        }catch(JSONException ignored) {
        }
    }

    void onConsumeFailure(@NonNull Product product, int responseCode, String debugMessage) {
        try {
            onConsumeFailure(mDelegate, product.toJson().toString(), responseCode, debugMessage);
        }catch(JSONException ignored) {
        }
    }

    void onQueryPurchasesSuccess(@NonNull JSONArray products) {
        onQueryPurchasesSuccess(mDelegate, products.toString());
    }

    void onQueryPurchasesFailure(int responseCode, String debugMessage) {
        onQueryPurchasesFailure(mDelegate, responseCode, debugMessage);
    }

    void onPlayPassStatusUpdate(boolean active, String productToken) {
        onPlayPassStatusUpdate(mDelegate, active, productToken);
    }
    
    void onUnConsumedProductsUpdate(@NonNull JSONArray products) {
        onUnConsumedProductsUpdate(mDelegate, products.toString());
    }
}
