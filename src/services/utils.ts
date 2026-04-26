import firestore from '@react-native-firebase/firestore';

export const convertDate = (val: any): Date | null => {
      if (!val) return null;
      if (val instanceof firestore.Timestamp) return val.toDate();
      if (val instanceof Date) return val;
      if (typeof val === 'object' && val.seconds !== undefined) {
        return new firestore.Timestamp(val.seconds, val.nanoseconds).toDate();
      }
      return null;
    };