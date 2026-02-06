package com.example.hello;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

public class MainActivity extends Activity {
    private int tapCount = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        final TextView greeting = findViewById(R.id.greeting);
        Button button = findViewById(R.id.tap_button);

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                tapCount++;
                greeting.setText(String.format(
                    getString(R.string.tapped_message), tapCount));
            }
        });
    }
}
