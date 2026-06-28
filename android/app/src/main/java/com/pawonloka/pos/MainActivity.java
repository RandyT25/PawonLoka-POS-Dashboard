package com.pawonloka.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pawonloka.pos.printing.PrintBridgePlugin;
import com.pawonloka.pos.printing.PrintForegroundService;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintBridgePlugin.class);
        super.onCreate(savedInstanceState);
        try { PrintForegroundService.start(this); } catch (Exception ignored) {}
    }
}
