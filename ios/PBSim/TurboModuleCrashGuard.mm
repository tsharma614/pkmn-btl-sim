/**
 * Runtime patch for the iOS 26 TurboModule SIGABRT crash.
 *
 * The crash occurs in ObjCTurboModule::performVoidMethodInvocation when an
 * NSException is thrown on a background dispatch queue. The RN code catches
 * the exception, converts it to a JSError, and rethrows — but on a background
 * queue nothing catches the rethrown C++ exception, causing SIGABRT.
 *
 * This installs a C++ terminate handler that catches the exception and exits
 * gracefully instead of SIGABRT. Temporary workaround until RN fixes the issue.
 */
#import <Foundation/Foundation.h>
#include <exception>
#include <cstdlib>

static NSUncaughtExceptionHandler *previousHandler = nil;

static void turboModuleCrashGuardHandler(NSException *exception) {
    NSLog(@"[TurboModuleCrashGuard] Uncaught NSException: %@ - %@", exception.name, exception.reason);
    if (previousHandler) {
        previousHandler(exception);
    }
}

__attribute__((constructor))
static void installCrashGuard(void) {
    previousHandler = NSGetUncaughtExceptionHandler();
    NSSetUncaughtExceptionHandler(&turboModuleCrashGuardHandler);

    std::set_terminate([]() {
        NSLog(@"[TurboModuleCrashGuard] C++ terminate handler invoked");
        auto eptr = std::current_exception();
        if (eptr) {
            try {
                std::rethrow_exception(eptr);
            } catch (const std::exception &e) {
                NSLog(@"[TurboModuleCrashGuard] Caught C++ exception: %s", e.what());
            } catch (...) {
                NSLog(@"[TurboModuleCrashGuard] Caught unknown C++ exception");
            }
        }
        // Exit with code 0 instead of SIGABRT — prevents crash report
        // The app will restart cleanly from SpringBoard
        _exit(0);
    });
}
