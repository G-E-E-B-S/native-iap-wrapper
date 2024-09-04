package com.wrapper.iap;

import com.android.billingclient.api.ProductDetails;

import org.json.JSONException;
import org.json.JSONObject;

public class Product {
    String id;
    String type;
    String title;
    String description;
    float priceValue;
    String price;
    String currencyCode;
    String receiptCipheredPayload;
    String receipt;
    String transactionID;
    String purchaseToken;

    public Product() {
        id = "iap";
        type = "t_y_p_e";
        title = "title";
        description = "desc";
        priceValue = 100;
        price = "Rs 100";
        currencyCode = "Rs";
        receiptCipheredPayload = "r";
        receipt = "rt";
        transactionID = "td";
        purchaseToken = "nil";
    }

    public static Product createFromProductDetails(ProductDetails productDetails, String type) {

        Product product = new Product();
        product.id = productDetails.getProductId(); //.replaceAll("_"," ") ;
        product.type = type;
        if (type.equals("subs")) {
            ProductDetails.PricingPhase pricingPhase = productDetails.getSubscriptionOfferDetails().get(0).getPricingPhases().getPricingPhaseList().get(0);
            product.price = pricingPhase.getFormattedPrice();
            product.currencyCode = pricingPhase.getPriceCurrencyCode();
            double priceValue = (double) pricingPhase.getPriceAmountMicros() / 1000000.0;
            product.priceValue = (float)priceValue;
        }
        else
        {
            product.price = productDetails.getOneTimePurchaseOfferDetails().getFormattedPrice();
            product.currencyCode = productDetails.getOneTimePurchaseOfferDetails().getPriceCurrencyCode();
            double priceValue = (double)productDetails.getOneTimePurchaseOfferDetails().getPriceAmountMicros() / 1000000.0;
            product.priceValue = (float)priceValue;
        }
        product.title = productDetails.getTitle();
        product.description = productDetails.getDescription();
        product.receipt = "";
        product.receiptCipheredPayload = "";
        product.transactionID = "";
        product.purchaseToken = "";
        return product;
    }

    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();

        json.put("id", id);
        json.put("type", type);
        json.put("title", title);
        json.put("description", description);
        json.put("price", price);
        json.put("priceValue", priceValue);
        json.put("currencyCode", currencyCode);
        json.put("receipt", receipt);
        json.put("receiptCipheredPayload", receiptCipheredPayload);
        json.put("transactionID", transactionID);
        json.put("purchaseToken", purchaseToken);
        return json;
    }

}
