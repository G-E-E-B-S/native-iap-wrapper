#include "GoogleIAP.h"
#include "cocos2d.h"
#include "logger/log.h"
#include "platform/android/jni/JniHelper.h"
#include "platform/CCApplication.h"
#include "base/CCScheduler.h"
#include "../external/sources/json/rapidjson.h"
#include "../external/sources/json/document-wrapper.h"
#include <cstring>

USING_NS_CC;

namespace sdkbox {

    Product getProductFromJsonDoc(const rapidjson::Value& document) {
        Product product;
        product.id = document["id"].GetString();
        product.type = std::strncmp(document["type"].GetString(), "consumable", 10) == 0 ? IAP_Type::CONSUMABLE : IAP_Type::NON_CONSUMABLE;
        product.title = document["title"].GetString();
        product.description = document["description"].GetString();
        product.price = document["price"].GetString();
        product.priceValue = document["priceValue"].GetFloat();
        product.currencyCode = document["currencyCode"].GetString();
        product.receipt = document["receipt"].GetString();
        product.receiptCipheredPayload= document["receiptCipheredPayload"].GetString();
        product.transactionID = document["transactionID"].GetString();
        product.purchaseToken = document["purchaseToken"].GetString();
        return product;
    }

    std::vector<Product> getProductsFromJsonDoc(const rapidjson::Document& document) {
        std::vector<Product> products;
        for (rapidjson::Value::ConstValueIterator iterator = document.Begin(); iterator != document.End(); ++iterator){
            const rapidjson::Value& document = *iterator;
            products.push_back(getProductFromJsonDoc(document));
        }
        return products;
    }

    extern "C" {
    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onInitialized(JNIEnv *env, jobject thiz, jlong delegate, jboolean success) {

        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        listener->onInitialized(success);
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onProductRequestSuccess(JNIEnv *env, jobject thiz, jlong delegate, jstring productListJson) {

        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productListJsonString = JniHelper::jstring2string(productListJson);
        rapidjson::Document document;
        document.Parse(productListJsonString.c_str());
        if(document.IsArray() == false) {
            listener->onProductRequestFailure("product request success, but parse json failed!!");
        }
        else {
            auto products = getProductsFromJsonDoc(document);
            listener->onProductRequestSuccess(products);
        }
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onProductRequestFailure(JNIEnv *env, jobject thiz, jlong delegate, jstring message) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto messageString = JniHelper::jstring2string(message);
        listener->onProductRequestFailure(messageString);
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onPurchaseHistoryRequestSuccess(JNIEnv *env, jobject thiz, jlong delegate, jstring purchaseListJson ) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto purchaseListJsonString = JniHelper::jstring2string(purchaseListJson);
        listener->onPurchaseHistory(purchaseListJsonString);
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onPurchaseSuccess(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(productJson);
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onSuccess(getProductFromJsonDoc(document));
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onPurchaseFailure(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson, jint responseCode, jstring message) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(productJson);
        auto messageString = JniHelper::jstring2string(message);
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onFailure(getProductFromJsonDoc(document), messageString, (int)responseCode);
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onPurchaseCanceled(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(productJson);        
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onCanceled(getProductFromJsonDoc(document));        
    }    

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onConsumeSuccess(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(productJson);        
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onConsumed(getProductFromJsonDoc(document));
    }   

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onConsumeFailure(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson, jint responseCode, jstring message) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(productJson);     
        auto messageString = JniHelper::jstring2string(message);   
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onConsumeFailure(getProductFromJsonDoc(document), messageString, (int)responseCode);
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onRestored(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(productJson);        
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onRestored(getProductFromJsonDoc(document));
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onRestoreFailure(JNIEnv *env, jobject thiz, jlong delegate, jint responseCode, jstring message) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productJsonString = JniHelper::jstring2string(nullptr);
        auto messageString = JniHelper::jstring2string(message);   
        rapidjson::Document document;
        document.Parse(productJsonString.c_str());
        listener->onRestoreFailure(getProductFromJsonDoc(document), messageString, (int)responseCode);
    }
    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onQueryPurchasesSuccess(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productListJsonString = JniHelper::jstring2string(productJson);
        rapidjson::Document document;
        document.Parse(productListJsonString.c_str());
        if(!document.IsArray()) {
            listener->onQueryPurchasesFailure(-1, "product request success, but parse json failed!!");
        } else {
            auto products = getProductsFromJsonDoc(document);
            listener->onQueryPurchasesSuccess(products);
        }
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onQueryPurchasesFailure(JNIEnv *env, jobject thiz, jlong delegate, jint responseCode, jstring message) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto messageString = JniHelper::jstring2string(message);
        listener->onQueryPurchasesFailure(responseCode, messageString);
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onPlayPassStatusUpdate(JNIEnv *env, jobject thiz, jlong delegate, jboolean active, jstring producToken) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);            
        auto producTokenString = JniHelper::jstring2string(producToken);   
        listener->onPlayPassStatusUpdate(active, producTokenString);           
    }

    JNIEXPORT void JNICALL
    Java_com_wrapper_iap_PurchaseEventListener_onUnConsumedProductsUpdate(JNIEnv *env, jobject thiz, jlong delegate, jstring productJson) {
        auto listener = reinterpret_cast<sdkbox::IAPListener *>(delegate);
        auto productListJsonString = JniHelper::jstring2string(productJson);
        rapidjson::Document document;
        document.Parse(productListJsonString.c_str());
        listener->onUnConsumedProductsUpdate(getProductsFromJsonDoc(document));
    }
    }
}