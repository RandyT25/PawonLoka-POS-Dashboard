package com.pawonloka.pos;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.pawonloka.pos.printing.PrintBridgePlugin;
import com.pawonloka.pos.printing.PrintForegroundService;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int BT_PERM_REQ = 42;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintBridgePlugin.class);
        super.onCreate(savedInstanceState);
        startPrintServiceWhenReady();
    }

    private void startPrintServiceWhenReady() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            List<String> needed = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.BLUETOOTH_CONNECT);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                    != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.BLUETOOTH_SCAN);
            if (!needed.isEmpty()) {
                ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), BT_PERM_REQ);
                return;
            }
        }
        try { PrintForegroundService.start(this); } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == BT_PERM_REQ) {
            try { PrintForegroundService.start(this); } catch (Exception ignored) {}
        }
    }
}
