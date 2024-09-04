#include "GoogleIAP.h"
#include "GoogleIAP_Java_Listener.h"
#include "logger/log.h"
#include "cocos2d.h"
#include "platform/android/jni/JniHelper.h"

USING_NS_CC;

namespace sdkbox
{
    static const char* CLASS_PURCHASE_MANAGER = "com/wrapper/iap/PurchaseManager";
    static const char* CLASS_PURCHASE_LISTENER = "com/wrapper/iap/PurchaseEventListener";
    static const std::string ConfigJsonPath = "res/sdkbox_config.json";
    static bool autoFinishTransaction = false;

    /**
     * get Instance of PurchaseManager (Java Object)
     * @return
     */
    jobject getJavaPurchaseManager() {
        JniMethodInfo methodInfo;
        if (!JniHelper::getStaticMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "getInstance", "()Lcom/wrapper/iap/PurchaseManager;")) {
            CC_ASSERT("can not get method info: com.wrapper.iap.PurchaseManager.getInstance()");
        }

        return methodInfo.env->CallStaticObjectMethod(methodInfo.classID, methodInfo.methodID);
    }

    /**
     * create Instance of PurchaseEventListener (Java Object)
     * @param listener
     * @return
     */
    jobject createJavaPurchaseEventListener(IAPListener* listener) {
        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_LISTENER, "<init>", "(J)V")) {
            CC_ASSERT("can not get method info: iap.PurchaseEventListener<init>");
        }

        // run java code:
        // long delegate = (long)listener;
        // return new iap.PurchaseEventListener(delegate);
        return methodInfo.env->NewObject(methodInfo.classID, methodInfo.methodID, (jlong)listener);
    }

    void IAP::setGDPR(bool enable){}

    void IAP::init(const char* jsconfig)
    {
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "init", "(Ljava/lang/String;)V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#init()");
        }
        const std::string& fullPath = FileUtils::getInstance()->fullPathForFilename(ConfigJsonPath);
        std::string configJsonString = FileUtils::getInstance()->getStringFromFile(fullPath);
        jstring jstrConfigJsonString = methodInfo.env->NewStringUTF(configJsonString.c_str());

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID, jstrConfigJsonString);
    }

    void IAP::initPlayPass(const std::string& noAdsPackId)
    {
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "initPlayPass", "(Ljava/lang/String;)V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#initPlayPass()");
        }

        jstring jstrNoAdsPackId = methodInfo.env->NewStringUTF(noAdsPackId.c_str());
        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID, jstrNoAdsPackId);  
    }

    void IAP::setDebug(bool debug){ }

    std::vector<Product> IAP::getProducts()
    { 
        std::vector<Product> products;
        return products;
    }

    void IAP::purchase(const std::string& name)
    { 
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "purchase", "(Ljava/lang/String;)V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#purchase()");
        }

        jstring jstrProductId = methodInfo.env->NewStringUTF(name.c_str());
        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID, jstrProductId);        
    }

    void IAP::refresh()
    { 
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "queryProductListAsync", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#queryProductListAsync()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID);        
    }

    void IAP::restore()
    { 
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "queryPurchases", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#queryPurchases()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID);        
    }

    void IAP::consume(const std::string& productId, const std::string& purchaseToken) {
        jobject javaPurchaseManager = getJavaPurchaseManager();
        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "consume", "(Ljava/lang/String;Ljava/lang/String;)V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#consume()");
        }
        jstring jstrProductId = methodInfo.env->NewStringUTF(productId.c_str());
        jstring jsrPurchaseToken = methodInfo.env->NewStringUTF(purchaseToken.c_str());
        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID, jstrProductId, jsrPurchaseToken);
    }

    void IAP::queryPurchases() {
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "queryPurchases", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#queryPurchases()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID);
    }

    void IAP::queryUnconsumedPurchases() {
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "queryUnconsumedPurchases", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#queryUnconsumedPurchases()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID);
    }

    void IAP::setListener(IAPListener* listener)
    {         
        jobject javaPurchaseManager = getJavaPurchaseManager();

        if(listener == nullptr) {
            removeListener();
            return;
        }

        jobject JavaListener = createJavaPurchaseEventListener(listener);
        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "setPurchaseEventListener", "(Lcom/wrapper/iap/PurchaseEventListener;)V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#setPurchaseEventListener()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID, JavaListener);        
    }

    void IAP::removeListener()
    { 
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "removePurchaseEventListener", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#removePurchaseEventListener()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID);   
    }

    void IAP::enableUserSideVerification( bool b){ }

    bool IAP::isAutoFinishTransaction(){
        return autoFinishTransaction;
    }

    void IAP::setAutoFinishTransaction(bool b){
        autoFinishTransaction = b;
    }

    void IAP::finishTransaction(const std::string productid){ }

    void IAP::fetchStorePromotionOrder(){ }
    void IAP::updateStorePromotionOrder(const std::vector<std::string>& productNames){ }
    void IAP::fetchStorePromotionVisibility(const std::string& productName){ }
    void IAP::updateStorePromotionVisibility(const std::string& productName, bool visibility){ }

    void IAP::getPurchaseHistory()
    { 
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "getPurchaseHistory", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#getPurchaseHistory()");
        }

        methodInfo.env->CallVoidMethod(javaPurchaseManager, methodInfo.methodID);        
    }

    std::string IAP::getInitializedErrMsg()
    { 
        return "error";
    }

    void IAP::requestUpdateTransaction(){ }

    bool IAP::isEnabled()
    {
        jobject javaPurchaseManager = getJavaPurchaseManager();

        JniMethodInfo methodInfo;
        if (!JniHelper::getMethodInfo(methodInfo, CLASS_PURCHASE_MANAGER, "isInitialized", "()V")) {
            CC_ASSERT("can not get method info: iap.PurchaseManager#isInitialized()");
        }

        return methodInfo.env->CallBooleanMethod(javaPurchaseManager, methodInfo.methodID);
    }
}