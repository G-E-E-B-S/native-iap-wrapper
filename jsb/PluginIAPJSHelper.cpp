#include "PluginIAPJSHelper.h"
#ifdef IS_ANDROID
#include "android/GoogleIAP/GoogleIAP.h"
#else
#include "PluginIAP/PluginIAP.h"
#endif
#include "SDKBoxJSHelper.h"

#include "cocos2d.h"
#include "base/CCScheduler.h"
#include "platform/CCApplication.h"

cocos2d::ValueMap product_to_map(const sdkbox::Product& p)
{
    cocos2d::ValueMap map;
    map["name"] = p.name;
    map["id"] = p.id;
    map["title"] = p.title;
    map["description"] = p.description;
    map["price"] = p.price;
    map["priceValue"] = p.priceValue;
    map["currencyCode"] = p.currencyCode;
    map["receipt"] = p.receipt;
    map["receiptCipheredPayload"] = p.receiptCipheredPayload;
    map["transactionID"] = p.transactionID;
#ifdef IS_ANDROID
    map["purchaseToken"] = p.purchaseToken;
#endif
    return map;
}

se::Value product_to_obj(const sdkbox::Product& p)
{
    cocos2d::ValueMap map = product_to_map(p);
    se::Value ret;
    ccvaluemap_to_seval(map, &ret);
    return ret;
}

se::Value products_to_obj(const std::vector<sdkbox::Product>& products)
{
    cocos2d::ValueVector jsproducts;
    for (auto p : products) {
        auto obj = product_to_map(p);
        jsproducts.push_back(cocos2d::Value(obj));
    }

    se::Value ret;
    ccvaluevector_to_seval(jsproducts, &ret);
    return ret;
}

class IAPListenerJS : public sdkbox::IAPListener, public sdkbox::JSListenerBase
{
public:
    IAPListenerJS() : sdkbox::JSListenerBase() {
    }

    void onSuccess(const sdkbox::Product& info) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(product_to_obj(info));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }
#ifdef IS_ANDROID
    void onFailure(const sdkbox::Product& info, const std::string& errorMsg, int errorCode) {
#else
    void onFailure(const sdkbox::Product& info, const std::string& errorMsg) {
#endif
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(product_to_obj(info));
        args.push_back(se::Value(errorMsg));
#ifdef IS_ANDROID
        args.push_back(se::Value(errorCode));
#endif        
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onCanceled(const sdkbox::Product& info) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(product_to_obj(info));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

#ifdef IS_ANDROID
    void onConsumed(const sdkbox::Product& p) {
#else
    void onConsumed(const sdkbox::Product& p, const std::string& error) {        
#endif
        RUN_ON_MAIN_THREAD_BEGIN
                    MAKE_V8_HAPPY

                    se::ValueArray args;
                    args.push_back(product_to_obj(p));
#ifndef IS_ANDROID
                    args.push_back(se::Value(error));
#endif
                    invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

#ifdef IS_ANDROID
    void onConsumeFailure(const sdkbox::Product& info, const std::string& errorMsg, int errorCode) {

        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(product_to_obj(info));
        args.push_back(se::Value(errorMsg));
        args.push_back(se::Value(errorCode));        
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }    
#endif    
    
    void onRestored(const sdkbox::Product& info) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(product_to_obj(info));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

#ifdef IS_ANDROID
    void onRestoreFailure(const sdkbox::Product& info, const std::string& errorMsg, int errorCode) {

        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(product_to_obj(info));
        args.push_back(se::Value(errorMsg));
        args.push_back(se::Value(errorCode));        
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }    
#endif

    void onProductRequestSuccess(const std::vector<sdkbox::Product>& products) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(products_to_obj(products)));

        this->invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onProductRequestFailure(const std::string& msg) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(msg));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }
    void onQueryPurchasesSuccess(const std::vector<sdkbox::Product>& products) {
        RUN_ON_MAIN_THREAD_BEGIN
                    MAKE_V8_HAPPY
                    se::ValueArray args;
                    args.push_back(se::Value(products_to_obj(products)));
                    this->invokeJSFun(funcName, args);
        RUN_ON_MAIN_THREAD_END
    }

    void onQueryPurchasesFailure(int errorCode, const std::string& msg) {
        RUN_ON_MAIN_THREAD_BEGIN
                    MAKE_V8_HAPPY
                    se::ValueArray args;
                    args.push_back(se::Value(errorCode));
                    args.push_back(se::Value(msg));
                    invokeJSFun(funcName, args);
        RUN_ON_MAIN_THREAD_END
    }

    void onInitialized(bool ok) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(ok));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onRestoreComplete(bool ok, const std::string& msg) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(ok));
        args.push_back(se::Value(msg));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    bool onShouldAddStorePayment(const std::string& productId) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(productId));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END

        //just return true, now
        return true;
    }

    void onFetchStorePromotionOrder(const std::vector<std::string>& productIds, const std::string& error) {

        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::Value jsproductIds;
        std_vector_string_to_seval(productIds, &jsproductIds);

        se::ValueArray args;
        args.push_back(se::Value(jsproductIds));
        args.push_back(se::Value(error));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onFetchStorePromotionVisibility(const std::string productId, bool visibility, const std::string& error) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(productId));
        args.push_back(se::Value(visibility));
        args.push_back(se::Value(error));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onUpdateStorePromotionOrder(const std::string& error) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(error));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onUpdateStorePromotionVisibility(const std::string& error) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(error));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }

    void onPurchaseHistory(const std::string& purchases) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(purchases));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }
#ifdef IS_ANDROID
    void onPlayPassStatusUpdate(bool active, const std::string& productToken) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(active));
        args.push_back(se::Value(productToken));
        invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END        
    }

    void onUnConsumedProductsUpdate(const std::vector<sdkbox::Product>& products) {
        RUN_ON_MAIN_THREAD_BEGIN
        MAKE_V8_HAPPY

        se::ValueArray args;
        args.push_back(se::Value(products_to_obj(products)));

        this->invokeJSFun(funcName, args);

        RUN_ON_MAIN_THREAD_END
    }
#endif

};

bool js_PluginIAPJS_IAP_getProducts(se::State& s)
{
    const auto& args = s.args();
    int argc = (int)args.size();
    if (argc == 0) {
        std::vector<sdkbox::Product> products = sdkbox::IAP::getProducts();

        se::Value jsret = products_to_obj(products);
        s.rval().setObject(jsret.toObject());
        return true;
    }
    SE_REPORT_ERROR("js_PluginIAPJS_IAP_getProducts : wrong number of arguments");
    return false;
}
SE_BIND_FUNC(js_PluginIAPJS_IAP_getProducts)

static bool js_PluginIAPJS_setListener(se::State& s)
{
    const auto& args = s.args();
    int argc = (int)args.size();
    if (argc == 1)
    {
        static IAPListenerJS* nativeDelegate = nullptr;
        if (!nativeDelegate) {
            nativeDelegate = new (std::nothrow) IAPListenerJS();
            sdkbox::IAP::setListener(nativeDelegate);
        }
        nativeDelegate->setJSDelegate(args[0]);

        return true;
    }

    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", argc, 1);
    return false;
}
SE_BIND_FUNC(js_PluginIAPJS_setListener)

extern se::Object* __jsb_sdkbox_IAP_proto;
extern se::Class* __jsb_sdkbox_IAP_class;
bool register_all_PluginIAPJS_helper(se::Object* obj)
{
    auto pluginValue = sdkbox::getPluginValue(obj, "sdkbox.IAP");
    auto plugin = pluginValue.toObject();
    plugin->defineFunction("setListener", _SE(js_PluginIAPJS_setListener));
    plugin->defineFunction("getProducts", _SE(js_PluginIAPJS_IAP_getProducts));

    se::ScriptEngine::getInstance()->clearException();
    return true;
}

