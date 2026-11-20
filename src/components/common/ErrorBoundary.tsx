import React from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CrashLogger } from '../../services/LoggingService';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches render-time errors anywhere below it in the tree instead of letting them
 * blow up the whole app to Metro's redbox (which isn't shown at all in release/dev-client
 * builds off the debugger). Surfaces the error message + component stack directly on
 * screen so it's clear which screen/component threw, and still forwards to Crashlytics.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ componentStack: errorInfo.componentStack ?? null });
    CrashLogger.error(error, `ErrorBoundary${errorInfo.componentStack ?? ''}`);
  }

  reset = () => this.setState({ error: null, componentStack: null });

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: '#ff6b6b', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            Something crashed
          </Text>
          <Text style={{ color: '#fff', fontSize: 15, marginBottom: 16 }}>{error.message}</Text>

          {__DEV__ && (
            <>
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>STACK</Text>
              <Text style={{ color: '#ddd', fontSize: 11, fontFamily: 'monospace', marginBottom: 16 }}>
                {error.stack}
              </Text>
              {componentStack && (
                <>
                  <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
                    COMPONENT STACK (which screen/component threw)
                  </Text>
                  <Text style={{ color: '#ddd', fontSize: 11, fontFamily: 'monospace', marginBottom: 16 }}>
                    {componentStack}
                  </Text>
                </>
              )}
            </>
          )}

          <TouchableOpacity
            onPress={this.reset}
            style={{ backgroundColor: '#ff6b6b', padding: 12, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try again</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }
}
