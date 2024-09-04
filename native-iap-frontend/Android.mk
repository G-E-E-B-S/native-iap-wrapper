LOCAL_PATH := $(call my-dir)
#===========================================================================
include $(CLEAR_VARS)
NDK_MODULE_PATH += $(LOCAL_PATH)/../android

LOCAL_MODULE := native-iap-frontend
LOCAL_MODULE_FILENAME := lib$(LOCAL_MODULE)

ifeq ($(USE_ARM_MODE),1)
LOCAL_ARM_MODE := arm
endif

LOCAL_SRC_FILES := ../android/GoogleIAP/GoogleIAP.cpp \
	../jsb/PluginIAPJS.cpp \
	../jsb/PluginIAPJSHelper.cpp \
	../jsb/SDKBoxJSHelper.cpp

LOCAL_CFLAGS    += -DIS_ANDROID
LOCAL_C_INCLUDES := $(LOCAL_PATH)/..
LOCAL_EXPORT_C_INCLUDES := $(LOCAL_C_INCLUDES)

LOCAL_STATIC_LIBRARIES := logging
LOCAL_STATIC_LIBRARIES += v8_static
LOCAL_STATIC_LIBRARIES += cocos2dx_static

include $(BUILD_STATIC_LIBRARY)

$(call import-module, cocos)
$(call import-module, logging)
#===========================================================================
